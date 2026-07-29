package vn.edu.dhv.tapattend.presentation

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.compose.ui.platform.LocalLifecycleOwner
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.io.File
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

@Composable
fun FaceVerificationScreen(
    studentName: String,
    studentCode: String,
    action: String,
    onVerifiedFrame: (String, Long) -> Unit,
    onCancel: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val executor = remember { Executors.newSingleThreadExecutor() }
    val imageCapture = remember {
        ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
            .setJpegQuality(82)
            .build()
    }
    var previewView by remember { mutableStateOf<PreviewView?>(null) }
    var instruction by remember { mutableStateOf(actionLabel(action)) }
    var faceReady by remember { mutableStateOf(false) }
    var completed by remember { mutableStateOf(false) }
    var eyesWereOpen by remember { mutableStateOf(false) }
    var eyesWereClosed by remember { mutableStateOf(false) }
    var turnReached by remember { mutableStateOf(false) }
    val startedAt = remember { System.currentTimeMillis() }

    val detector = remember {
        FaceDetection.getClient(
            FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
                .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
                .enableTracking()
                .build()
        )
    }

    fun inspect(face: Face) {
        faceReady = true
        when (action) {
            "BLINK" -> {
                val left = face.leftEyeOpenProbability ?: 1f
                val right = face.rightEyeOpenProbability ?: 1f
                if (left > 0.75f && right > 0.75f) eyesWereOpen = true
                if (eyesWereOpen && left < 0.3f && right < 0.3f) eyesWereClosed = true
                if (eyesWereClosed && left > 0.7f && right > 0.7f) completed = true
            }
            "TURN_LEFT" -> {
                if (face.headEulerAngleY < -18f) {
                    turnReached = true
                    instruction = "Tốt, hãy nhìn thẳng lại"
                }
                if (turnReached && kotlin.math.abs(face.headEulerAngleY) < 8f) completed = true
            }
            "TURN_RIGHT" -> {
                if (face.headEulerAngleY > 18f) {
                    turnReached = true
                    instruction = "Tốt, hãy nhìn thẳng lại"
                }
                if (turnReached && kotlin.math.abs(face.headEulerAngleY) < 8f) completed = true
            }
        }
        if (completed) instruction = "Đã đạt liveness, giữ nguyên khuôn mặt"
    }

    DisposableEffect(previewView, lifecycleOwner) {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        val listener = Runnable {
            val provider = cameraProviderFuture.get()
            val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView?.surfaceProvider) }
            val analysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
            analysis.setAnalyzer(executor) { proxy ->
                val mediaImage = proxy.image
                if (mediaImage == null) {
                    proxy.close()
                } else {
                    detector.process(InputImage.fromMediaImage(mediaImage, proxy.imageInfo.rotationDegrees))
                        .addOnSuccessListener { faces ->
                            ContextCompat.getMainExecutor(context).execute {
                                if (faces.size == 1) inspect(faces.first()) else faceReady = false
                            }
                        }
                        .addOnCompleteListener { proxy.close() }
                }
            }
            provider.unbindAll()
            provider.bindToLifecycle(
                lifecycleOwner,
                CameraSelector.DEFAULT_FRONT_CAMERA,
                preview,
                imageCapture,
                analysis
            )
        }
        cameraProviderFuture.addListener(listener, ContextCompat.getMainExecutor(context))
        onDispose {
            if (cameraProviderFuture.isDone) cameraProviderFuture.get().unbindAll()
            detector.close()
            executor.shutdown()
        }
    }

    LaunchedEffect(completed) {
        if (completed) {
            captureJpeg(context, imageCapture) { dataUrl ->
                onVerifiedFrame(dataUrl, System.currentTimeMillis() - startedAt)
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(Color(0xFFF4F7FA))) {
        Surface(color = Color(0xFF10233F), modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("XÁC MINH KHUÔN MẶT", color = Color(0xFFE85555), fontSize = 10.sp)
                Text(studentName, color = Color.White, fontSize = 22.sp, modifier = Modifier.padding(top = 7.dp))
                Text("MSSV $studentCode", color = Color(0xFFB6C2D1), fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
            }
        }
        Box(modifier = Modifier.weight(1f).fillMaxWidth().background(Color(0xFF07111F))) {
            AndroidView(
                factory = { PreviewView(it).also { view -> previewView = view } },
                modifier = Modifier.fillMaxSize()
            )
            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(width = 240.dp, height = 310.dp)
                    .border(2.dp, if (faceReady) Color(0xFF16A36A) else Color.White, RoundedCornerShape(110.dp))
            )
            Surface(
                color = Color(0xDD10233F),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.align(Alignment.BottomCenter).padding(18.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 13.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(modifier = Modifier.size(9.dp).background(if (faceReady) Color(0xFF16A36A) else Color(0xFFE85555), CircleShape))
                    Text(instruction, color = Color.White, fontSize = 13.sp)
                }
            }
        }
        Button(
            onClick = onCancel,
            colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Color(0xFF10233F)),
            modifier = Modifier.fillMaxWidth().padding(16.dp)
        ) { Text("HỦY VÀ QUÉT LẠI THẺ") }
    }
}

private fun actionLabel(action: String) = when (action) {
    "BLINK" -> "Hãy chớp cả hai mắt"
    "TURN_LEFT" -> "Hãy quay mặt sang trái"
    "TURN_RIGHT" -> "Hãy quay mặt sang phải"
    else -> "Nhìn thẳng vào camera"
}

private fun captureJpeg(context: Context, imageCapture: ImageCapture, onReady: (String) -> Unit) {
    val file = File.createTempFile("face_verify_", ".jpg", context.cacheDir)
    val options = ImageCapture.OutputFileOptions.Builder(file).build()
    imageCapture.takePicture(
        options,
        ContextCompat.getMainExecutor(context),
        object : ImageCapture.OnImageSavedCallback {
            override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                val source = BitmapFactory.decodeFile(file.absolutePath) ?: run {
                    file.delete()
                    return
                }
                val scale = minOf(1f, 640f / source.width.toFloat())
                val resized = if (scale < 1f) {
                    Bitmap.createScaledBitmap(
                        source,
                        (source.width * scale).toInt(),
                        (source.height * scale).toInt(),
                        true
                    )
                } else source
                val stream = ByteArrayOutputStream()
                resized.compress(Bitmap.CompressFormat.JPEG, 82, stream)
                if (resized !== source) resized.recycle()
                source.recycle()
                val encoded = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
                file.delete()
                onReady("data:image/jpeg;base64,$encoded")
            }
            override fun onError(exception: ImageCaptureException) {
                file.delete()
            }
        }
    )
}
