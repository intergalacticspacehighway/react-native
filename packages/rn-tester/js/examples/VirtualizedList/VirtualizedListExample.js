import React from 'react';
import { SafeAreaView, View, VirtualizedList, StyleSheet, Text, StatusBar, Pressable } from 'react-native';

const DATA = [];

const getItem = (data, index) => ({
  id: Math.random().toString(12).substring(0),
  title: `Item ${index+1}`
});

const getItemCount = (data) => 50;

const Item = ({ title }) => (
  <Pressable style={styles.item}>
    <Text style={styles.title}>{title}</Text>
  </Pressable>
);

const VirtualizedListExample = () => {
  return (
    <SafeAreaView style={styles.container}>
      <VirtualizedList
        data={DATA}
        initialNumToRender={4}
        renderItem={({ item }) => <Item title={item.title} />}
        keyExtractor={item => item.id}
        getItemCount={getItemCount}
        getItem={getItem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: StatusBar.currentHeight,
  },
  item: {
    backgroundColor: '#f9c2ff',
    height: 150,
    justifyContent: 'center',
    marginVertical: 8,
    marginHorizontal: 16,
    padding: 20,
  },
  title: {
    fontSize: 32,
  },
});



exports.title = 'VirtualizedList';
exports.documentationURL = 'https://reactnative.dev/docs/virtualizedlist';
exports.category = 'ListView';
exports.displayName = 'VirtualizedListExample';
exports.description = 'Base implementation for the more convenient <FlatList> and <SectionList> components';
exports.examples = [
  {
    title: 'VirtualizedList example',
    name: 'basic',
    render() {
      return <VirtualizedListExample />;
    },
  },
];
