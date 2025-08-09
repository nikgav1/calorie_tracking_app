import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { api } from '../auth/api';

export function LogFoodScreen() {
  const cameraRef = useRef(null);

  const [showCamera, setShowCamera] = useState(false);
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [taking, setTaking] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [photo, setPhoto] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  // ---------- Initial UI ----------
  function InitialUI() {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.title}>Add Meal</Text>

        <View style={styles.infoBox}>
          <Text>Enter meal name, quantity or other details here (replace this placeholder with your form).</Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={async () => {
            if (!permission) {
              await requestPermission();
            }
            if (permission?.granted) {
              setShowCamera(true);
              setIsCameraReady(false);
            } else {
              const p = await requestPermission();
              if (p?.granted) {
                setShowCamera(true);
                setIsCameraReady(false);
              } else {
                Alert.alert('Permission required', 'Camera permission is required to take a photo.');
              }
            }
          }}
        >
          <Text style={styles.primaryButtonText}>Open Camera</Text>
        </TouchableOpacity>

        {uploadResult ? (
          <View style={styles.infoBox}>
            <Text>Last upload result:</Text>
            <Text>{uploadResult.name}</Text>
            <Text>{uploadResult.ccal}</Text>
            <Text>{uploadResult.protein}</Text>
            <Text>{uploadResult.fat}</Text>
            <Text>{uploadResult.carbohydrates}</Text>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  // ---------- Camera UI ----------
  function CameraUI() {
    const toggleFacing = () => setFacing((f) => (f === 'back' ? 'front' : 'back'));

    const onCameraReady = () => {
      setTimeout(() => setIsCameraReady(true), 120);
    };

    // TRY WITHOUT skipProcessing FIRST (safer for some iOS devices)
    const takePicture = async () => {
      if (!cameraRef.current) return;
      if (!isCameraReady) {
        console.warn('Camera not ready yet.');
        return;
      }
      if (taking) return;

      // Toggle this to false if you want to try skipProcessing first instead.
      const tryWithoutSkipFirst = true;

      const guardDelay = (ms) => new Promise((res) => setTimeout(res, ms));

      const doCapture = async (opts) => {
        await guardDelay(120); // stabilize frames
        return cameraRef.current.takePictureAsync(opts);
      };

      setTaking(true);
      try {
        let result = null;

        if (tryWithoutSkipFirst) {
          // 1) try without skipProcessing (full processing)
          try {
            result = await doCapture({ quality: 0.7 });
          } catch (err1) {
            // 2) fallback: try with skipProcessing
            console.debug('First capture failed, retrying with skipProcessing.', err1?.message ?? err1);
            await guardDelay(220);
            result = await doCapture({ quality: 0.7, skipProcessing: true });
          }
        } else {
          // alternative order: try skipProcessing first
          try {
            result = await doCapture({ quality: 0.7, skipProcessing: true });
          } catch (err1) {
            console.debug('skipProcessing first failed, retrying without skipProcessing.', err1?.message ?? err1);
            await guardDelay(220);
            result = await doCapture({ quality: 0.6 });
          }
        }

        if (!result || !result.uri) throw new Error('No image URI returned');

        console.log('takePicture success:', result.uri);
        setPhoto(result);
      } catch (err) {
        console.error('takePictureAsync error', err);
        Alert.alert('Camera error', `Could not capture image: ${String(err?.message ?? err)}`);
      } finally {
        setTaking(false);
      }
    };

    return (
      <View style={styles.container}>
        <Text style={styles.smallStatus}>{String('Camera open')}</Text>

        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          onCameraReady={onCameraReady}
        />

        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.overlayText}>Frame your food</Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => {
              setShowCamera(false);
              setPhoto(null);
            }}
          >
            <Text style={styles.controlText}>Close</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={toggleFacing}>
            <Text style={styles.controlText}>Flip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.captureButton}
            onPress={takePicture}
            disabled={!isCameraReady || taking}
          >
            {taking ? <ActivityIndicator /> : <Text style={styles.captureText}>Take</Text>}
          </TouchableOpacity>

          <View style={{ width: 40 }} />
        </View>
      </View>
    );
  }

  // ---------- Upload ----------
  async function uploadPhotoWithApi(photoFile) {
    if (!photoFile?.uri) {
      Alert.alert('No photo', 'No photo to upload');
      return;
    }

    const uri = photoFile.uri;
    const filename = uri.split('/').pop() || `photo.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1].toLowerCase() : 'jpg';
    const mimeType =
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : `image/${ext}`;

    const form = new FormData();
    form.append('image', {
      uri,
      name: filename,
      type: mimeType,
    });
    form.append('source', 'expo-app');

    try {
      setUploading(true);
      const response = await api.post('/api/analyze', form);
      setUploadResult(JSON.parse(response.data.nutritionData));
      // handleAfterUpload(response.data);
      setUploading(false);
      setPhoto(null);
      setShowCamera(false);
    } catch (err) {
      setUploading(false);
      const message =
        err?.response?.data?.message ||
        err?.response?.status ||
        err?.message ||
        'Upload failed';
      console.error('upload error', err);
      Alert.alert('Upload failed', String(message));
    }
  }

  function handleAfterUpload(serverData) {
    setUploadResult(JSON.stringify(serverData));
    Alert.alert('Upload success', 'Photo uploaded and server returned data.');
  }

  // ---------- Render ----------
  if (showCamera && photo) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.smallStatus}>{String('Preview — ready to upload')}</Text>
        <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="contain" />
        <View style={styles.bottomRow}>
          <TouchableOpacity style={styles.controlButton} onPress={() => setPhoto(null)}>
            <Text style={styles.controlText}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: '#2ecc71' }]}
            onPress={() => uploadPhotoWithApi(photo)}
            disabled={uploading}
          >
            {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.controlText}>Upload</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (showCamera) return <CameraUI />;

  return <InitialUI />;
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  infoBox: { padding: 12, marginVertical: 12, borderRadius: 8, backgroundColor: '#eee', width: '100%' },

  container: { flex: 1, backgroundColor: '#000' },
  smallStatus: {
    position: 'absolute',
    top: 8,
    left: 12,
    right: 12,
    color: '#fff',
    zIndex: 10,
  },

  camera: { flex: 1 },
  overlay: { position: 'absolute', top: 40, left: 0, right: 0, alignItems: 'center' },
  overlayText: { color: '#fff', fontSize: 16 },
  controls: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  controlButton: { backgroundColor: '#333', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  controlText: { color: '#fff', fontWeight: '600' },
  captureButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  captureText: { fontWeight: '700', color: '#000' },

  preview: { flex: 1, width: '100%', backgroundColor: '#000', marginTop: 40 },
  bottomRow: { height: 100, backgroundColor: '#000', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },

  primaryButton: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: '#007aff', borderRadius: 8 },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
});
