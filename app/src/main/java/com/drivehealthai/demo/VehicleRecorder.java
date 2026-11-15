package com.drivehealthai.demo;

import android.car.Car;
import android.car.VehicleGear;
import android.car.VehiclePropertyIds;
import android.car.hardware.CarPropertyValue;
import android.car.hardware.property.CarPropertyManager;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.SystemClock;
import android.util.Log;
import org.json.JSONArray;

final class VehicleRecorder {
    interface Listener {
        void status(String message, boolean busy);
        void completed(String samples);
    }

    private static final float PARK_SPEED_LIMIT = 0.3f;

    private final Context context;
    private final Listener listener;
    private final HandlerThread thread = new HandlerThread("VehicleRecorder");
    private final Handler worker;
    private Car car;
    private CarPropertyManager properties;
    private JSONArray samples;
    private long start;
    private long lastSample;
    private long lastSpeedTimestamp;
    private long firstSpeedTimestamp;
    private boolean sawSignalGap;
    private boolean waitingForSignal;
    private boolean moved;
    private boolean leftPark;

    VehicleRecorder(Context context, Listener listener) {
        this.context = context;
        this.listener = listener;
        thread.start();
        worker = new Handler(thread.getLooper());
    }

    void start() {
        worker.post(new Runnable() {
            @Override public void run() { connect(); }
        });
    }

    private void connect() {
        if (car != null || samples != null) return;
        try {
            if (Build.VERSION.SDK_INT < 29) {
                car = Car.createCar(context);
                if (car == null) throw new IllegalStateException();
                beginRecording(car);
                return;
            }
            listener.status("차량 서비스 연결을 기다리는 중입니다.", true);
            car = Car.createCar(context, worker, Car.CAR_WAIT_TIMEOUT_DO_NOT_WAIT,
                    new Car.CarServiceLifecycleListener() {
                        @Override public void onLifecycleChanged(final Car connection, final boolean ready) {
                            worker.post(new Runnable() {
                                @Override public void run() { onServiceState(connection, ready); }
                            });
                        }
                    });
            if (car == null) throw new IllegalStateException();
            worker.postDelayed(connectionTimeout, 5000);
        } catch (SecurityException e) {
            stop("차속과 변속 위치를 읽을 권한을 확인하세요.");
        } catch (RuntimeException e) {
            stop("차량 신호를 읽을 수 없습니다. 지원 차량과 권한을 확인하세요.");
        }
    }

    private void onServiceState(Car connection, boolean ready) {
        if (connection != car) return;
        if (ready && samples == null) beginRecording(connection);
        else if (!ready && properties != null) {
            stop("차량 서비스 연결이 끊겼습니다. 이전 저장 기록은 유지됩니다.");
        }
    }

    private final Runnable connectionTimeout = new Runnable() {
        @Override public void run() {
            if (samples == null) stop("차량 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
    };

    private void beginRecording(Car connection) {
        worker.removeCallbacks(connectionTimeout);
        try {
            properties = (CarPropertyManager) connection.getCarManager(Car.PROPERTY_SERVICE);
            if (properties == null) throw new IllegalStateException();
            if (gear() != VehicleGear.GEAR_PARK || Math.abs(speed().getValue()) > PARK_SPEED_LIMIT) {
                stop("P 상태에서 차량 기록을 시작해 주세요.");
                return;
            }
            samples = new JSONArray();
            moved = false;
            leftPark = false;
            start = SystemClock.elapsedRealtime();
            lastSample = -1;
            lastSpeedTimestamp = -1;
            firstSpeedTimestamp = -1;
            sawSignalGap = false;
            waitingForSignal = false;
            showRecordingStatus();
            tick.run();
        } catch (SecurityException e) {
            stop("차속과 변속 위치를 읽을 권한을 확인하세요.");
        } catch (RuntimeException e) {
            stop("차량 신호를 읽을 수 없습니다. 지원 차량과 권한을 확인하세요.");
        }
    }

    private int gear() {
        int gear = property(Integer.class, VehiclePropertyIds.GEAR_SELECTION).getValue();
        switch (gear) {
            case VehicleGear.GEAR_PARK:
            case VehicleGear.GEAR_DRIVE:
            case VehicleGear.GEAR_REVERSE:
            case VehicleGear.GEAR_NEUTRAL:
            case VehicleGear.GEAR_FIRST:
            case VehicleGear.GEAR_SECOND:
            case VehicleGear.GEAR_THIRD:
            case VehicleGear.GEAR_FOURTH:
            case VehicleGear.GEAR_FIFTH:
            case VehicleGear.GEAR_SIXTH:
            case VehicleGear.GEAR_SEVENTH:
            case VehicleGear.GEAR_EIGHTH:
            case VehicleGear.GEAR_NINTH:
                return gear;
            default:
                throw new IllegalStateException("Unknown selection");
        }
    }

    private CarPropertyValue<Float> speed() {
        CarPropertyValue<Float> entry = property(Float.class, VehiclePropertyIds.PERF_VEHICLE_SPEED);
        float value = entry.getValue();
        long timestamp = entry.getTimestamp();
        long age = SystemClock.elapsedRealtimeNanos() - timestamp;
        if (!Float.isFinite(value) || Math.abs(value) > 300f / 3.6f
                || timestamp <= 0 || age < 0 || age > 2_000_000_000L) {
            throw new IllegalStateException();
        }
        return entry;
    }

    private <T> CarPropertyValue<T> property(Class<T> type, int property) {
        CarPropertyValue<T> entry = properties.getProperty(type, property, 0);
        if (entry == null || entry.getStatus() != CarPropertyValue.STATUS_AVAILABLE
                || entry.getValue() == null) throw new IllegalStateException();
        return entry;
    }

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (samples == null) return;
            long elapsed = SystemClock.elapsedRealtime() - start;
            if (elapsed > 7_200_000) {
                stop("2시간 기록 한도에 도달했습니다. 이전 저장 기록은 유지됩니다.");
                return;
            }
            if (elapsed - Math.max(0, lastSample) > 2000) {
                stop("차량 신호가 2초 넘게 끊겼습니다. 이전 저장 기록은 유지됩니다.");
                return;
            }
            final int gear;
            final CarPropertyValue<Float> speedEntry;
            try {
                gear = gear();
                speedEntry = speed();
                if (gear == VehicleGear.GEAR_PARK && Math.abs(speedEntry.getValue()) > PARK_SPEED_LIMIT) {
                    throw new IllegalStateException("Park and speed disagree");
                }
            } catch (SecurityException e) {
                stop("차량 신호에 접근할 권한이 없습니다. 이전 저장 기록은 유지됩니다.");
                return;
            } catch (RuntimeException e) {
                sawSignalGap = lastSample >= 0;
                showWaitingStatus();
                worker.postDelayed(this, 500);
                return;
            }
            elapsed = SystemClock.elapsedRealtime() - start;
            if (elapsed - Math.max(0, lastSample) > 2000) {
                stop("차량 신호 응답이 늦어 기록을 종료했습니다. 이전 저장 기록은 유지됩니다.");
                return;
            }
            long speedTimestamp = speedEntry.getTimestamp();
            if (speedTimestamp <= lastSpeedTimestamp) {
                if (speedTimestamp < lastSpeedTimestamp) sawSignalGap = true;
                if (sawSignalGap || elapsed - lastSample > 1000) showWaitingStatus();
                worker.postDelayed(this, 500);
                return;
            }
            long speedInterval = lastSpeedTimestamp < 0 ? 0 : speedTimestamp - lastSpeedTimestamp;
            if (speedInterval > 2_000_000_000L) {
                stop("차량 차속 표본 간격이 2초를 넘었습니다. 이전 저장 기록은 유지됩니다.");
                return;
            }
            if (firstSpeedTimestamp < 0) firstSpeedTimestamp = speedTimestamp;
            float speed = speedEntry.getValue();
            try {
                double sampleTime = (speedTimestamp - firstSpeedTimestamp) / 1_000_000_000.0;
                JSONArray sample = new JSONArray().put(sampleTime).put((double) speed);
                if (sawSignalGap || (lastSample >= 0 && (elapsed - lastSample > 1000
                        || speedInterval > 1_000_000_000L))) {
                    sample.put(true);
                }
                samples.put(sample);
                lastSample = elapsed;
                lastSpeedTimestamp = speedTimestamp;
                sawSignalGap = false;
                if (waitingForSignal) showRecordingStatus();
                if (gear != VehicleGear.GEAR_PARK) leftPark = true;
                if (leftPark && Math.abs(speed) >= 5f / 3.6f) moved = true;
                if (leftPark && gear == VehicleGear.GEAR_PARK && Math.abs(speed) <= PARK_SPEED_LIMIT) {
                    if (!moved || samples.length() < 3) {
                        stop("분석할 주행 기록이 부족합니다.");
                        return;
                    }
                    String result = samples.toString();
                    disconnect();
                    listener.completed(result);
                    return;
                }
                worker.postDelayed(this, 500);
            } catch (RuntimeException | org.json.JSONException e) {
                stop("기록 중 차량 신호를 읽지 못했습니다. 다시 연결해 주세요.");
            }
        }
    };

    private void showWaitingStatus() {
        if (!waitingForSignal) {
            waitingForSignal = true;
            listener.status("차량 신호가 끊겼습니다. 다시 수신하는 중입니다.", true);
        }
    }

    private void showRecordingStatus() {
        waitingForSignal = false;
        listener.status("차량 기록 중 · 주차 후 자동 분석", true);
    }

    void cancel() {
        worker.post(new Runnable() {
            @Override public void run() { stop("차량 기록을 취소했습니다."); }
        });
    }

    void close() {
        worker.post(new Runnable() {
            @Override public void run() {
                disconnect();
                thread.quitSafely();
            }
        });
    }

    private void stop(String message) {
        disconnect();
        listener.status(message, false);
    }

    private void disconnect() {
        samples = null;
        worker.removeCallbacks(tick);
        worker.removeCallbacks(connectionTimeout);
        Car connection = car;
        car = null;
        properties = null;
        if (connection != null) {
            try {
                connection.disconnect();
            } catch (RuntimeException e) {
                Log.w("VehicleRecorder", "Vehicle service disconnect failed", e);
            }
        }
    }
}
