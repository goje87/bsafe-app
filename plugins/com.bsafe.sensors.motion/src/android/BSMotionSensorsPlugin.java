
package com.bsafe.sensors.motion;

import java.util.List;

import org.apache.cordova.CordovaWebView;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.opengl.Matrix;

import android.os.Handler;
import android.os.Looper;

/**
 * This class listens to the accelerometer sensor and stores the latest
 * acceleration values x,y,z.
 */
public class BSMotionSensorsPlugin extends CordovaPlugin implements SensorEventListener {

    public static int STOPPED = 0;
    public static int STARTING = 1;
    public static int RUNNING = 2;
    public static int ERROR_FAILED_TO_START = 3;

    private long timestamp;                         // time of most recent value
    private int status;                                 // status of listener
    private int accuracy = SensorManager.SENSOR_STATUS_ACCURACY_HIGH;

    private SensorManager sensorManager;    // Sensor manager
    private Sensor mSensor;                           // Acceleration sensor returned by sensor manager
    private CallbackContext callbackContext;              // Keeps track of the JS callback context.
    private Reading accelReading;
    private Reading gravityReading;
    private float[] gData = new float[3];
    private float[] mData = new float[3];

    /**
     * Create an accelerometer listener.
     */
    public BSMotionSensorsPlugin() {
        this.timestamp = 0;
        this.setStatus(BSMotionSensorsPlugin.STOPPED);
     }

    /**
     * Sets the context of the Command. This can then be used to do things like
     * get file paths associated with the Activity.
     *
     * @param cordova The context of the main Activity.
     * @param webView The associated CordovaWebView.
     */
    @Override
    public void initialize(CordovaInterface cordova, CordovaWebView webView) {
        super.initialize(cordova, webView);
        this.sensorManager = (SensorManager) cordova.getActivity().getSystemService(Context.SENSOR_SERVICE);
    }

    /**
     * Executes the request.
     *
     * @param action        The action to execute.
     * @param args          The exec() arguments.
     * @param callbackId    The callback id used when calling back into JavaScript.
     * @return              Whether the action was valid.
     */
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) {
        if(action.equals("getList")) {
            List<Sensor> list = this.sensorManager.getSensorList(Sensor.TYPE_ALL);
            JSONArray sensors = new JSONArray();
            for(int i = 0; i < list.size(); i++) {
                Sensor sensor = list.get(i);
                sensors.put(sensor.getStringType());
            }

            this.win(sensors);
            return true;
        }
        if (action.equals("start")) {
            this.callbackContext = callbackContext;
            if (this.status != BSMotionSensorsPlugin.RUNNING) {
                // If not running, then this is an async call, so don't worry about waiting
                // We drop the callback onto our stack, call start, and let start and the sensor callback fire off the callback down the road
                this.start();
            }
        }
        else if (action.equals("stop")) {
            if (this.status == BSMotionSensorsPlugin.RUNNING) {
                this.stop();
            }
        } else {
          // Unsupported action
            return false;
        }

        PluginResult result = new PluginResult(PluginResult.Status.NO_RESULT, "");
        result.setKeepCallback(true);
        callbackContext.sendPluginResult(result);
        return true;
    }

    /**
     * Called by AccelBroker when listener is to be shut down.
     * Stop listener.
     */
    public void onDestroy() {
        this.stop();
    }

    //--------------------------------------------------------------------------
    // LOCAL METHODS
    //--------------------------------------------------------------------------
    //
    /**
     * Start listening for acceleration sensor.
     *
     * @return          status of listener
    */
    private int start() {
        // If already starting or running, then restart timeout and return
        if ((this.status == BSMotionSensorsPlugin.RUNNING) || (this.status == BSMotionSensorsPlugin.STARTING)) {
            return this.status;
        }

        this.setStatus(BSMotionSensorsPlugin.STARTING);
        boolean isAccelRegistered = this.sensorManager.registerListener(this, this.sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION), this.sensorManager.SENSOR_DELAY_GAME);
        boolean isGravityRegistered = this.sensorManager.registerListener(this, this.sensorManager.getDefaultSensor(Sensor.TYPE_GRAVITY),this.sensorManager.SENSOR_DELAY_GAME);
        boolean isMagneticRegistered = this.sensorManager.registerListener(this, this.sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD),this.sensorManager.SENSOR_DELAY_GAME);

        if(!isAccelRegistered || !isGravityRegistered || !isMagneticRegistered) {
            this.setStatus(BSMotionSensorsPlugin.ERROR_FAILED_TO_START);
            this.fail(BSMotionSensorsPlugin.ERROR_FAILED_TO_START, "Device sensors returned an error");
        }

        return this.status;
    }
    /**
     * Stop listening to acceleration sensor.
     */
    private void stop() {
        if (this.status != BSMotionSensorsPlugin.STOPPED) {
            this.sensorManager.unregisterListener(this);
        }
        this.setStatus(BSMotionSensorsPlugin.STOPPED);
        this.accuracy = SensorManager.SENSOR_STATUS_UNRELIABLE;
    }

    /**
     * Called when the accuracy of the sensor has changed.
     *
     * @param sensor
     * @param accuracy
     */
    public void onAccuracyChanged(Sensor sensor, int accuracy) {

    }

    /**
     * Sensor listener event.
     *
     * @param SensorEvent event
     */
    public void onSensorChanged(SensorEvent event) {
        // If not running, then just return
        if (this.status == BSMotionSensorsPlugin.STOPPED) {
            return;
        }

        synchronized(this) {
            Sensor sensor = event.sensor;
            float[] aData = new float[3];

            switch(sensor.getType()) {
                case Sensor.TYPE_LINEAR_ACCELERATION:
                    aData = event.values.clone();

                    if(gData == null || mData == null) return;

                    this.setStatus(BSMotionSensorsPlugin.RUNNING);

                    float[] R = new float[16];
                    float[] iR = new float[16];
                    float[] I = new float[16];

                    SensorManager.getRotationMatrix(R, I, gData, mData);
                    float resultVec[] = new float[4];
                    float relAcc[] = new float[4];

                    relAcc[0] = aData[0];
                    relAcc[1] = aData[1];
                    relAcc[2] = aData[2];
                    relAcc[3] = 0;

                    Matrix.invertM(iR, 0, R, 0);
                    Matrix.multiplyMV(resultVec, 0, iR, 0, relAcc, 0);

                    JSONObject result = new JSONObject();
                    Reading linearAcceleration = new Reading(aData);
                    Reading acceleration = new Reading(resultVec);
                    Reading gravity = new Reading(this.gData);
                    Reading magneticField = new Reading(this.mData);

                    try {
                        result.put("timestamp", System.currentTimeMillis());
                        result.put("linearAcceleration", linearAcceleration.getJSON());
                        result.put("acceleration", acceleration.getJSON());
                        result.put("gravity", gravity.getJSON());
                        result.put("magneticField", magneticField.getJSON());
                    }
                    catch(JSONException e) {
                        e.printStackTrace();
                    }

                    this.win(result);

                break;
                case Sensor.TYPE_GRAVITY:
                    this.gData = event.values.clone();
                break;
                case Sensor.TYPE_MAGNETIC_FIELD:
                    this.mData = event.values.clone();
                break;
            }
        }
    }

    /**
     * Called when the view navigates.
     */
    @Override
    public void onReset() {
        if (this.status == BSMotionSensorsPlugin.RUNNING) {
            this.stop();
        }
    }

    // Sends an error back to JS
    private void fail(int code, String message) {
        // Error object
        JSONObject errorObj = new JSONObject();
        try {
            errorObj.put("code", code);
            errorObj.put("message", message);
        } catch (JSONException e) {
            e.printStackTrace();
        }
        PluginResult err = new PluginResult(PluginResult.Status.ERROR, errorObj);
        this.callbackWithPluginResult(err);
    }

    private void win(JSONObject r) {
        PluginResult result = new PluginResult(PluginResult.Status.OK, r);
        this.callbackWithPluginResult(result);
    }

    private void win(JSONArray r) {
        PluginResult result = new PluginResult(PluginResult.Status.OK, r);
        this.callbackWithPluginResult(result);
    }

    private void callbackWithPluginResult(PluginResult result) {
        result.setKeepCallback(true);
        callbackContext.sendPluginResult(result);
    }

    private void setStatus(int status) {
        this.status = status;
    }
}

class Reading {

    public float x, y, z;
    String type;

    public Reading(float x, float y, float z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    public Reading(float[] values) {
        this.x = values[0];
        this.y = values[1];
        this.z = values[2];
    }

    public JSONObject getJSON() {
        JSONObject r = new JSONObject();

        try {
            r.put("x", this.x);
            r.put("y", this.y);
            r.put("z", this.z);
        }
        catch(JSONException e) {
            e.printStackTrace();
        }
        return r;
    }
}
