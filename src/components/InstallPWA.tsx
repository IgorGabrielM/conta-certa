import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function InstallPWA() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallModal, setShowInstallModal] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        if (Platform.OS === 'web') {
            const userAgent = window.navigator.userAgent.toLowerCase();
            const isIosDevice = /iphone|ipad|ipod/.test(userAgent);

            // Verifica se já está rodando instalado como PWA no iOS
            const isIosStandalone = (window.navigator as any).standalone === true;
            // Verifica se é o Safari nativo do iOS (e não Chrome/Firefox no iOS)
            const isSafari = isIosDevice && /safari/.test(userAgent) && !/crios|fxios/.test(userAgent);

            if (isIosDevice && isSafari && !isIosStandalone) {
                setIsIOS(true);
                // Aguarda um instante para não abrir o modal logo de cara ao carregar a página
                const timer = setTimeout(() => {
                    setShowInstallModal(true);
                }, 2000);
                return () => clearTimeout(timer);
            }

            // Lógica padrão para Android / Chrome / Desktop
            const handleBeforeInstallPrompt = (e: Event) => {
                e.preventDefault();
                setDeferredPrompt(e);
                setShowInstallModal(true);
            };

            window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

            return () => {
                window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            };
        }
    }, []);

    const handleInstallClick = async () => {
        if (isIOS) {
            // No iOS não há prompt automático, apenas fechamos o modal para ele seguir as instruções visuais
            setShowInstallModal(false);
            return;
        }

        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('Usuário aceitou instalar o PWA');
        }

        setDeferredPrompt(null);
        setShowInstallModal(false);
    };

    if (!showInstallModal) return null;

    return (
        <Modal
            visible={showInstallModal}
            transparent
            animationType="fade"
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.iconContainer}>
                        <Ionicons
                            name={isIOS ? "share-outline" : "phone-portrait-outline"}
                            size={32}
                            color="#2b2d42"
                        />
                    </View>

                    <Text style={styles.modalTitle}>Instalar o Conta Certa</Text>

                    {isIOS ? (
                        <View style={styles.iosInstructionsContainer}>
                            <Text style={styles.modalMessage}>
                                Para instalar este aplicativo no seu iPhone/iPad, siga os passos abaixo:
                            </Text>
                            <View style={styles.stepRow}>
                                <Text style={styles.stepNumber}>1.</Text>
                                <Text style={styles.stepText}>
                                    Toque no botão de <Text style={{ fontWeight: 'bold' }}>Compartilhar</Text> <Ionicons name="share-outline" size={16} color="#007AFF" /> na barra inferior do Safari.
                                </Text>
                            </View>
                            <View style={styles.stepRow}>
                                <Text style={styles.stepNumber}>2.</Text>
                                <Text style={styles.stepText}>
                                    Role para cima e selecione <Text style={{ fontWeight: 'bold' }}>"Adicionar à Tela de Início"</Text> <Ionicons name="add-outline" size={16} color="#333" />.
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <Text style={styles.modalMessage}>
                            Instale nosso aplicativo na sua tela inicial para ter acesso rápido, funcionamento offline e experiência de tela cheia!
                        </Text>
                    )}

                    <TouchableOpacity style={styles.installButton} onPress={handleInstallClick}>
                        <Text style={styles.installButtonText}>
                            {isIOS ? 'Entendi' : 'Instalar Agora'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setShowInstallModal(false)}
                    >
                        <Text style={styles.closeButtonText}>Agora não</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#e0e7ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 15,
    },
    iosInstructionsContainer: {
        width: '100%',
        marginBottom: 15,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    stepNumber: {
        fontWeight: 'bold',
        color: '#2b2d42',
        marginRight: 8,
        fontSize: 14,
    },
    stepText: {
        flex: 1,
        fontSize: 13,
        color: '#444',
        lineHeight: 18,
    },
    installButton: {
        width: '100%',
        backgroundColor: '#2b2d42',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
    },
    installButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 15,
    },
    closeButton: {
        paddingVertical: 8,
    },
    closeButtonText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '600',
    },
});