import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AdBanner() {
    useEffect(() => {
        // Se você tiver uma conta no Google AdSense, pode carregar o script aqui
        try {
            // @ts-ignore
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.error('Erro ao carregar AdSense:', e);
        }
    }, []);

    return (
        <View style={styles.webContainer}>
            {/* Exemplo 1: Se você já tiver AdSense ativado, use o ins do AdSense */}
            {/*
            <ins className="adsbygoogle"
                 style={{ display: 'block', width: '728px', height: '90px' }}
                 data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
                 data-ad-slot="1234567890"
                 data-ad-format="auto"
                 data-full-width-responsive="true"></ins>
            */}

            {/* Exemplo 2: Enquanto desenvolve/testa na Web */}
            <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>Espaço de Anúncio Web (Google AdSense)</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    webContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: 10,
        backgroundColor: '#f1f3f5',
    },
    placeholder: {
        width: '90%',
        maxWidth: 728,
        height: 60,
        backgroundColor: '#e9ecef',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ced4da',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        color: '#6c757d',
        fontSize: 12,
        fontWeight: 'bold',
    },
});