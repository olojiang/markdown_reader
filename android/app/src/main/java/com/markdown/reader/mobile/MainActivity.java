package com.markdown.reader.mobile;

import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private volatile boolean readerReadingMode = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new ReaderAndroidBridge(), "markdownReaderAndroid");
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int keyCode = event.getKeyCode();
        boolean isVolumeKey = keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN;

        if (!isVolumeKey || !readerReadingMode || getBridge() == null || getBridge().getWebView() == null) {
            return super.dispatchKeyEvent(event);
        }

        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            dispatchVolumeKey(keyCode);
        }

        return true;
    }

    private void dispatchVolumeKey(int keyCode) {
        WebView webView = getBridge().getWebView();
        String key = keyCode == KeyEvent.KEYCODE_VOLUME_UP ? "AudioVolumeUp" : "AudioVolumeDown";
        String script = "window.dispatchEvent(new KeyboardEvent('keydown', {key: '" + key + "', code: '" + key + "', bubbles: true}));";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private final class ReaderAndroidBridge {
        @JavascriptInterface
        public void setReadingMode(boolean isReadingMode) {
            readerReadingMode = isReadingMode;
        }
    }
}
