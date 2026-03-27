import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212', justifyContent: 'space-between' },
    loadingContainer: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

    statusBox: { backgroundColor: '#1E1E1E', padding: 20, borderBottomWidth: 1, borderColor: '#333', minHeight: 120, justifyContent: 'center' },
    statusText: { color: '#4CAF50', fontSize: 20, fontWeight: '600', textAlign: 'center', lineHeight: 28 },

    transcriptBox: { minHeight: 40, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    transcriptText: { color: '#aaa', fontSize: 16, fontStyle: 'italic', textAlign: 'center' },

    micButton: { flex: 1, backgroundColor: '#2196F3', margin: 20, borderRadius: 40, justifyContent: 'center', alignItems: 'center', elevation: 10 },
    micButtonActive: { backgroundColor: '#F44336' },
    micButtonText: { fontSize: 80, marginBottom: 10 },
    micButtonSubText: { fontSize: 24, fontWeight: 'bold', color: '#fff', letterSpacing: 2 },

    devInputContainer: { flexDirection: 'row', padding: 15, backgroundColor: '#1E1E1E' },
    input: { flex: 1, backgroundColor: '#333', color: '#fff', borderRadius: 25, paddingHorizontal: 20, fontSize: 16, height: 50 },
    sendBtn: { backgroundColor: '#4CAF50', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    sendBtnText: { color: '#fff', fontSize: 20 },

    portalOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FF9800', padding: 30, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20 },
    portalHeader: { fontSize: 16, fontWeight: 'bold', color: '#B36B00', textAlign: 'center', marginBottom: 5 },
    portalName: { fontSize: 28, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 20 },
    portalBtnContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 15 },
    portalBtn: { backgroundColor: '#fff', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 15, minWidth: 120, alignItems: 'center' },
    portalBtnText: { color: '#FF9800', fontWeight: 'bold', fontSize: 22 }
});