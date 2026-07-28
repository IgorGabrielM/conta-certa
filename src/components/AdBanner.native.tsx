import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

const androidAdUnitId = 'ca-app-pub-9152634405201558/1008523972';
const iosAdUnitId = 'ca-app-pub-3940256099942544/2934735716'; // ID de Teste do iOS

const adUnitId = __DEV__
    ? TestIds.BANNER
    : Platform.select({
        android: androidAdUnitId,
        ios: iosAdUnitId,
        default: TestIds.BANNER,
    });

export default function AdBanner() {
    return (
        <View style={styles.container}>
            <BannerAd
                unitId={adUnitId}
                size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                requestOptions={{
                    requestNonPersonalizedAdsOnly: true,
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        backgroundColor: '#f8f9fa',
        paddingVertical: 5,
    },
});