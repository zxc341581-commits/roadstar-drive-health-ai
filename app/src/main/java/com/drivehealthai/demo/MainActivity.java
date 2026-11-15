package com.drivehealthai.demo;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowInsets;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
    private static final int PICK_CSV = 101;
    private static final int SPEED_PERMISSION = 102;
    private static final String CAR_SPEED = "android.car.permission.CAR_SPEED";
    private static final String HOME = "file:///android_asset/index.html";
    private WebView view;
    private VehicleRecorder recorder;
    private boolean speedPermissionPending;
    private ValueCallback<Uri[]> pendingFile;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        view = new WebView(this);
        view.setBackgroundColor(0xfff4f6f8);
        view.getSettings().setJavaScriptEnabled(true);
        view.getSettings().setDomStorageEnabled(true);
        view.getSettings().setAllowFileAccess(false);
        view.getSettings().setAllowContentAccess(true);
        view.getSettings().setBlockNetworkLoads(true);
        view.addJavascriptInterface(new VehicleBridge(), "DriveVehicle");
        view.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView web, WebResourceRequest request) {
                return !HOME.equals(request.getUrl().toString());
            }
        });
        view.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView web, ValueCallback<Uri[]> callback,
                                                       FileChooserParams params) {
                if (pendingFile != null) pendingFile.onReceiveValue(null);
                pendingFile = callback;
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.setType("*/*");
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                try {
                    startActivityForResult(picker, PICK_CSV);
                } catch (android.content.ActivityNotFoundException ignored) {
                    pendingFile.onReceiveValue(null);
                    pendingFile = null;
                }
                return true;
            }
        });
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            view.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                    android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                    v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                    return insets;
                }
            });
        }
        setContentView(view);
        view.loadUrl(HOME);
    }

    public final class VehicleBridge {
        @JavascriptInterface public void start() {
            runOnUiThread(new Runnable() {
                @Override public void run() { startVehicleRecording(); }
            });
        }

        @JavascriptInterface public void cancel() {
            runOnUiThread(new Runnable() {
                @Override public void run() { if (recorder != null) recorder.cancel(); }
            });
        }
    }

    private void startVehicleRecording() {
        if (view == null || isFinishing() || speedPermissionPending) return;
        if (!getPackageManager().hasSystemFeature("android.hardware.type.automotive")) {
            showVehicleStatus("이 기기는 Android Automotive 차량 신호를 제공하지 않습니다.", false);
            return;
        }
        if (checkSelfPermission(CAR_SPEED) != PackageManager.PERMISSION_GRANTED) {
            speedPermissionPending = true;
            try {
                requestPermissions(new String[]{CAR_SPEED}, SPEED_PERMISSION);
            } catch (RuntimeException e) {
                speedPermissionPending = false;
                showVehicleStatus("차속 권한 요청을 열지 못했습니다.", false);
            }
            return;
        }
        if (recorder == null) recorder = new VehicleRecorder(this, new VehicleRecorder.Listener() {
            @Override public void status(String message, boolean busy) {
                showVehicleStatus(message, busy);
            }
            @Override public void completed(String samples) {
                execute("window.acceptVehicleTrip(" + samples + ", true)");
            }
        });
        recorder.start();
    }

    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(request, permissions, grants);
        if (request != SPEED_PERMISSION) return;
        speedPermissionPending = false;
        if (grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED) startVehicleRecording();
        else showVehicleStatus("차속 권한이 필요합니다. CSV와 예제 모드는 사용할 수 있습니다.", false);
    }

    private void showVehicleStatus(String message, boolean busy) {
        execute("window.showVehicleStatus(" + JSONObject.quote(message) + "," + busy + ")");
    }

    private void execute(final String script) {
        runOnUiThread(new Runnable() {
            @Override public void run() { if (view != null) view.evaluateJavascript(script, null); }
        });
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_CSV && pendingFile != null) {
            ValueCallback<Uri[]> callback = pendingFile;
            pendingFile = null;
            Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
            callback.onReceiveValue(uri == null ? null : new Uri[] {uri});
        }
    }

    @Override protected void onDestroy() {
        if (pendingFile != null) pendingFile.onReceiveValue(null);
        pendingFile = null;
        if (recorder != null) recorder.close();
        if (view != null) view.destroy();
        view = null;
        super.onDestroy();
    }
}
