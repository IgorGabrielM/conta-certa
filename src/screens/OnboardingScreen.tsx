import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Dimensions,
    SafeAreaView,
    Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

interface Slide {
    id: string;
    icon: string;
    title: string;
    subtitle: string;
    description: string;
}

const SLIDES: Slide[] = [
    {
        id: '1',
        icon: '📊',
        title: 'Controle Total',
        subtitle: 'Suas Finanças na Palma da Mão',
        description: 'Acompanhe entradas, saídas e saldos acumulados com gráficos claros e objetivos.',
    },
    {
        id: '2',
        icon: '📅',
        title: 'Calendário Inteligente',
        subtitle: 'Nunca Mais Pague Juros',
        description: 'Visualize suas contas a pagar e a receber marcadas dia a dia no calendário.',
    },
    {
        id: '3',
        icon: '🚀',
        title: 'Alcançar Objetivos',
        subtitle: 'Planejamento de Longo Prazo',
        description: 'Organize suas finanças por categorias e mantenha o foco na sua liberdade financeira.',
    },
];

export default function OnboardingScreen({ navigation }: any) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;

    // Atualiza o scroll do Animated.Value
    const handleScroll = Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: false }
    );

    // Atualiza o índice atual baseado no scroll manual do usuário
    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems && viewableItems.length > 0) {
            const index = viewableItems[0].index;
            if (index !== null && index !== undefined) {
                setCurrentIndex(index);
            }
        }
    }).current;

    // Finaliza o onboarding e navega para o App Principal
    async function handleFinishOnboarding() {
        try {
            await AsyncStorage.setItem('@has_seen_onboarding', 'true');
            navigation.replace('MainApp');
        } catch (error) {
            console.error('Erro ao salvar status do onboarding:', error);
            navigation.replace('MainApp');
        }
    }

    // Ação do Botão "Próximo" / "Começar Agora"
    function handleNext() {
        if (currentIndex < SLIDES.length - 1) {
            const nextIndex = currentIndex + 1;
            // Rola para o próximo slide calculando o offset exato
            flatListRef.current?.scrollToOffset({
                offset: nextIndex * width,
                animated: true,
            });
            setCurrentIndex(nextIndex);
        } else {
            handleFinishOnboarding();
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Botão de Pular */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleFinishOnboarding} activeOpacity={0.6}>
                    <Text style={styles.skipText}>Pular</Text>
                </TouchableOpacity>
            </View>

            {/* Carrossel de Slides */}
            <FlatList
                ref={flatListRef}
                data={SLIDES}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                onScroll={handleScroll}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                getItemLayout={(_, index) => ({
                    length: width,
                    offset: width * index,
                    index,
                })}
                renderItem={({ item }) => (
                    <View style={styles.slide}>
                        <View style={styles.iconContainer}>
                            <Text style={styles.icon}>{item.icon}</Text>
                        </View>
                        <Text style={styles.subtitle}>{item.subtitle.toUpperCase()}</Text>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.description}>{item.description}</Text>
                    </View>
                )}
            />

            {/* Rodapé: Indicadores de página (Dots) e Botão Principal */}
            <View style={styles.footer}>
                {/* Dots Animados */}
                <View style={styles.dotsContainer}>
                    {SLIDES.map((_, index) => {
                        const inputRange = [
                            (index - 1) * width,
                            index * width,
                            (index + 1) * width,
                        ];

                        const dotWidth = scrollX.interpolate({
                            inputRange,
                            outputRange: [10, 28, 10],
                            extrapolate: 'clamp',
                        });

                        const opacity = scrollX.interpolate({
                            inputRange,
                            outputRange: [0.3, 1, 0.3],
                            extrapolate: 'clamp',
                        });

                        return (
                            <Animated.View
                                key={index}
                                style={[styles.dot, { width: dotWidth, opacity }]}
                            />
                        );
                    })}
                </View>

                {/* Botão Próximo / Começar */}
                <TouchableOpacity style={styles.button} onPress={handleNext} activeOpacity={0.8}>
                    <Text style={styles.buttonText}>
                        {currentIndex === SLIDES.length - 1 ? 'Começar Agora 🚀' : 'Próximo'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 16,
        alignItems: 'flex-end',
    },
    skipText: {
        color: '#94a3b8',
        fontSize: 15,
        fontWeight: '600',
    },
    slide: {
        width,
        paddingHorizontal: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#1e293b',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
        borderWidth: 1,
        borderColor: '#334155',
    },
    icon: {
        fontSize: 64,
    },
    subtitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#38bdf8',
        letterSpacing: 1.5,
        marginBottom: 8,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: 16,
    },
    description: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
        lineHeight: 24,
    },
    footer: {
        paddingHorizontal: 32,
        paddingBottom: 40,
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    dot: {
        height: 8,
        borderRadius: 4,
        backgroundColor: '#38bdf8',
        marginHorizontal: 4,
    },
    button: {
        backgroundColor: '#38bdf8',
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#38bdf8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    buttonText: {
        color: '#0f172a',
        fontSize: 18,
        fontWeight: '700',
    },
});