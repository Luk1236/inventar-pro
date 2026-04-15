import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  PanResponder,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

const { width } = Dimensions.get('window');

interface SignaturePadProps {
  visible: boolean;
  onClose: () => void;
  onSave: (signatureBase64: string) => void;
  title?: string;
  description?: string;
}

export default function SignaturePad({ 
  visible, 
  onClose, 
  onSave, 
  title = "Unterschrift",
  description = "Bitte unterschreiben Sie zur Bestätigung"
}: SignaturePadProps) {
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const svgRef = useRef<any>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(`M${locationX},${locationY}`);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(prev => `${prev} L${locationX},${locationY}`);
      },
      onPanResponderRelease: () => {
        if (currentPath) {
          setPaths(prev => [...prev, currentPath]);
          setCurrentPath('');
        }
      },
    })
  ).current;

  const clearSignature = () => {
    setPaths([]);
    setCurrentPath('');
  };

  const saveSignature = () => {
    if (paths.length === 0) {
      Alert.alert('Hinweis', 'Bitte unterschreiben Sie zuerst');
      return;
    }

    // Create SVG string
    const svgWidth = width - 48;
    const svgHeight = 200;
    const allPaths = paths.join(' ');
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">
      <path d="${allPaths}" stroke="#1C1C1E" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

    // Convert to base64
    const base64 = btoa(svgString);
    const signatureData = `data:image/svg+xml;base64,${base64}`;
    
    onSave(signatureData);
    clearSignature();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={28} color="#8E8E93" />
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={clearSignature}>
              <Text style={styles.clearText}>Löschen</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>{description}</Text>

          {/* Signature Canvas */}
          <View style={styles.canvasContainer} {...panResponder.panHandlers}>
            <Svg 
              ref={svgRef}
              style={styles.canvas} 
              width={width - 48} 
              height={200}
            >
              {paths.map((path, index) => (
                <Path
                  key={index}
                  d={path}
                  stroke="#1C1C1E"
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {currentPath && (
                <Path
                  d={currentPath}
                  stroke="#1C1C1E"
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </Svg>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureHint}>Hier unterschreiben</Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={saveSignature}>
              <Ionicons name="checkmark" size={20} color="white" />
              <Text style={styles.saveButtonText}>Bestätigen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  clearText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16,
  },
  canvasContainer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
    marginBottom: 24,
    position: 'relative',
  },
  canvas: {
    backgroundColor: 'transparent',
  },
  signatureLine: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: '#C7C7CC',
  },
  signatureHint: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 12,
    color: '#C7C7CC',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
