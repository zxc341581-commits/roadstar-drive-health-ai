from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory

temporary=TemporaryDirectory(prefix="drive-recorder-test-")
root=Path(temporary.name)
stubs={
"android/util/Log.java":"package android.util; public class Log {public static int w(String t,String m,Throwable e){return 0;}}",
"android/content/Context.java":"package android.content; public class Context {}",
"android/os/Build.java":"package android.os; public class Build {public static class VERSION {public static int SDK_INT=28;}}",
"android/os/SystemClock.java":"package android.os; public class SystemClock { public static long now; public static long elapsedRealtime(){return now;} public static long elapsedRealtimeNanos(){return now*1_000_000L;} }",
"android/os/HandlerThread.java":"package android.os; public class HandlerThread { public HandlerThread(String name){} public void start(){} public Object getLooper(){return null;} public void quitSafely(){} }",
"android/os/Handler.java":"""package android.os;
public class Handler {
 public static Runnable next;
 public Handler(Object looper) {}
 public void post(Runnable runnable){runnable.run();}
 public void postDelayed(Runnable runnable,long delay){next=runnable;}
 public void removeCallbacks(Runnable runnable){if(next==runnable)next=null;}
 public static void tick(long time){SystemClock.now=time; Runnable work=next; next=null; work.run();}
}""",
"android/car/VehicleGear.java":"package android.car; public class VehicleGear {public static final int GEAR_UNKNOWN=0,GEAR_NEUTRAL=1,GEAR_REVERSE=2,GEAR_PARK=4,GEAR_DRIVE=8,GEAR_FIRST=16,GEAR_SECOND=32,GEAR_THIRD=64,GEAR_FOURTH=128,GEAR_FIFTH=256,GEAR_SIXTH=512,GEAR_SEVENTH=1024,GEAR_EIGHTH=2048,GEAR_NINTH=4096;}",
"android/car/VehiclePropertyIds.java":"package android.car; public class VehiclePropertyIds {public static final int GEAR_SELECTION=1,PERF_VEHICLE_SPEED=2;}",
"android/car/Car.java":"""package android.car;
import android.car.hardware.property.CarPropertyManager;
import android.content.Context;
import android.os.Handler;
public class Car {
 public static final String PROPERTY_SERVICE="property";
 public static final long CAR_WAIT_TIMEOUT_DO_NOT_WAIT=0;
 public interface CarServiceLifecycleListener {void onLifecycleChanged(Car car,boolean ready);}
 public static Car createCar(Context context,Handler handler,long wait,CarServiceLifecycleListener listener){return new Car();}
 public static boolean failDisconnect;
 public static Car createCar(Context context){return new Car();}
 public Object getCarManager(String property){return new CarPropertyManager();}
 public void disconnect(){if(failDisconnect)throw new IllegalStateException();}
}""",
"android/car/hardware/CarPropertyValue.java":"""package android.car.hardware;
public class CarPropertyValue<T> {
 public static final int STATUS_AVAILABLE=0;
 private final T value;
 private final long timestamp;
 public CarPropertyValue(T value,long timestamp){this.value=value;this.timestamp=timestamp;}
 public long getTimestamp(){return timestamp;}
 public int getStatus(){return 0;}
 public T getValue(){return value;}
}""",
"android/car/hardware/property/CarPropertyManager.java":"""package android.car.hardware.property;
import android.car.hardware.CarPropertyValue;
import android.os.SystemClock;
public class CarPropertyManager {
 public static int gear=4;
 public static float speed;
 public static boolean missing,denied;
 public static long forcedSpeedTimestamp=-1;
 public <T> CarPropertyValue<T> getProperty(Class<T> type,int id,int area){
  if(denied)throw new SecurityException();
  if(missing)return null;
  return new CarPropertyValue<T>(id==1?type.cast(gear):type.cast(speed),
     id==2&&forcedSpeedTimestamp>=0?forcedSpeedTimestamp:SystemClock.elapsedRealtimeNanos());
 }
}""",
"org/json/JSONException.java":"package org.json; public class JSONException extends Exception {}",
"org/json/JSONArray.java":"""package org.json;
import java.util.ArrayList;
public class JSONArray {
 final ArrayList<Object> items=new ArrayList<>();
 public JSONArray put(double value) throws JSONException {items.add(value);return this;}
 public JSONArray put(Object value){items.add(value);return this;}
 public int length(){return items.size();}
 public String toString(){return items.toString();}
}""",
"com/drivehealthai/demo/RecorderHarness.java":"""package com.drivehealthai.demo;
import android.car.Car;
import android.car.VehicleGear;
import android.os.Handler;
import android.os.SystemClock;
import android.content.Context;
import android.car.hardware.property.CarPropertyManager;
public class RecorderHarness {
 static class Capture implements VehicleRecorder.Listener {
  String status, completed;
  int waits;
  public void status(String message,boolean busy){
   status=message;
   if(busy&&message.contains("다시 수신"))waits++;
  }
  public void completed(String samples){completed=samples;}
 }
 public static void main(String[] args) {
  Capture capture=new Capture();
  VehicleRecorder recorder=new VehicleRecorder(new Context(),capture);
  SystemClock.now=1000;
  recorder.start();
  CarPropertyManager.gear=8;
  CarPropertyManager.speed=12;
  Handler.tick(1500);
  CarPropertyManager.missing=true;
  Handler.tick(2000);
  if(capture.waits!=1||!capture.status.contains("다시 수신"))throw new AssertionError(capture.status);
  CarPropertyManager.missing=false;
  Handler.tick(2500);
  if(!capture.status.contains("주차 후 자동 분석"))throw new AssertionError(capture.status);
  CarPropertyManager.gear=4;
  CarPropertyManager.speed=0;
  Car.failDisconnect=true;
  Handler.tick(3000);
  Car.failDisconnect=false;
  if(capture.completed==null||!capture.completed.contains("[1.5, 12.0, true]"))
    throw new AssertionError(capture.completed);
  recorder.start();
  CarPropertyManager.missing=true;
  for(int ms=3500; ms<=5500;ms+=500)Handler.tick(ms);
  if(!capture.status.contains("2초")||Handler.next!=null||capture.waits!=2)
    throw new AssertionError(capture.status);
  CarPropertyManager.missing=false;
  recorder.start();
  CarPropertyManager.denied=true;
  Handler.tick(6000);
  if(!capture.status.contains("권한")||Handler.next!=null)throw new AssertionError(capture.status);
  CarPropertyManager.denied=false;
  capture.completed=null;
  recorder.start();
  CarPropertyManager.gear=8;
  CarPropertyManager.speed=12;
  Handler.tick(6500);
  CarPropertyManager.forcedSpeedTimestamp=6_500_000_000L;
  Handler.tick(7000);
  CarPropertyManager.forcedSpeedTimestamp=-1;
  Handler.tick(7500);
  CarPropertyManager.gear=4;
  CarPropertyManager.speed=0;
  Handler.tick(8000);
  if(capture.completed==null||capture.completed.contains("[1.0,")||!capture.completed.contains("[1.5, 12.0]"))
    throw new AssertionError(capture.completed);
  recorder.start();
  CarPropertyManager.forcedSpeedTimestamp=8_000_000_000L;
  for(int ms=8500;ms<=10500;ms+=500)Handler.tick(ms);
  if(!capture.status.contains("2초")||Handler.next!=null)throw new AssertionError(capture.status);
  CarPropertyManager.forcedSpeedTimestamp=-1;
  CarPropertyManager.forcedSpeedTimestamp=1_000_000_000L;
  recorder.start();
  if(!capture.status.contains("신호를 읽을 수 없습니다")||Handler.next!=null)
    throw new AssertionError(capture.status);
  CarPropertyManager.forcedSpeedTimestamp=20_000_000_000L;
  recorder.start();
  if(!capture.status.contains("신호를 읽을 수 없습니다")||Handler.next!=null)
    throw new AssertionError(capture.status);
  CarPropertyManager.forcedSpeedTimestamp=-1;
  CarPropertyManager.gear=8;
  recorder.start();
  if(!capture.status.contains("P 상태")||Handler.next!=null)
    throw new AssertionError(capture.status);
  CarPropertyManager.gear=4;
  recorder.start();
  capture.completed=null;
  CarPropertyManager.gear=8;
  CarPropertyManager.speed=12;
  CarPropertyManager.forcedSpeedTimestamp=10_900_000_000L;
  Handler.tick(11000);
  CarPropertyManager.forcedSpeedTimestamp=11_200_000_000L;
  Handler.tick(11500);
  CarPropertyManager.gear=4;
  CarPropertyManager.speed=0;
  CarPropertyManager.forcedSpeedTimestamp=11_850_000_000L;
  Handler.tick(12000);
  if(capture.completed==null||!capture.completed.contains("[0.4, 12.0]")
      ||!capture.completed.contains("[0.7, 12.0]")||!capture.completed.contains("[1.35, 0.0]"))
    throw new AssertionError(capture.completed);
  CarPropertyManager.forcedSpeedTimestamp=11_000_000_000L;
  recorder.start();
  CarPropertyManager.forcedSpeedTimestamp=13_050_000_000L;
  Handler.tick(13100);
  if(!capture.status.contains("표본 간격이 2초")||Handler.next!=null)
    throw new AssertionError(capture.status);
  CarPropertyManager.forcedSpeedTimestamp=-1;
  CarPropertyManager.gear=VehicleGear.GEAR_UNKNOWN;
  recorder.start();
  if(!capture.status.contains("신호를 읽을 수 없습니다")||Handler.next!=null)
    throw new AssertionError(capture.status);
  CarPropertyManager.gear=VehicleGear.GEAR_PARK;
  capture.completed=null;
  recorder.start();
  CarPropertyManager.gear=VehicleGear.GEAR_UNKNOWN;
  CarPropertyManager.speed=10;
  Handler.tick(13600);
  CarPropertyManager.gear=VehicleGear.GEAR_PARK;
  Handler.tick(14100);
  CarPropertyManager.gear=VehicleGear.GEAR_NINTH;
  Handler.tick(14600);
  CarPropertyManager.gear=VehicleGear.GEAR_PARK;
  CarPropertyManager.speed=0;
  Handler.tick(15100);
  if(capture.completed==null||capture.completed.contains("[0.5," )||capture.completed.contains("[1.0,")
      ||!capture.completed.contains("[1.5, 10.0, true]"))
    throw new AssertionError(capture.completed);
  recorder.close();
  if(Handler.next!=null)throw new AssertionError("pending callback after close");
  System.out.println("VehicleRecorder JVM fake-clock checks: P-D-P with dropout, timeout, permission failure, cached speed, source clock, invalid gear, conflicting Park, close passed.");
 }
}"""
}
sources=[]
for name,body in stubs.items():
 p=root/name
 p.parent.mkdir(parents=True,exist_ok=True)
 p.write_text(body)
 sources.append(str(p))
out=root/"out"
out.mkdir(exist_ok=True)
source = Path(__file__).resolve().parents[1] / "app/src/main/java/com/drivehealthai/demo/VehicleRecorder.java"
sources.append(str(source))
subprocess.run(["java","-m","jdk.compiler/com.sun.tools.javac.Main","-d",str(out),*sources],check=True)
subprocess.run(["java","-cp",str(out),"com.drivehealthai.demo.RecorderHarness"],check=True)
