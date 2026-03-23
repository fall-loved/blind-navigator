import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 10,
        backgroundColor: '#fff',
        marginTop: 30
    },
    header: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center'
    },
    status: {
        fontSize: 16,
        color: 'green',
        marginBottom: 10
    },
    block: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 10,
        marginBottom: 10
    },
    blockTitle: {
        fontWeight: 'bold',
        marginBottom: 5
    },
    button: {
        backgroundColor: '#007AFF',
        padding: 12,
        marginVertical: 5,
        alignItems: 'center'
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold'
    },
    row: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 5
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 8,
        flex: 1,
        marginRight: 5
    }
});