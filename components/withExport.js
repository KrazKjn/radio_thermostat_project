import React from 'react';
import { View, Button, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const flattenObject = (obj, prefix = '') => {
  const flat = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      Object.assign(flat, flattenObject(value, fullKey));
    } else {
      flat[fullKey] = value;
    }
  }
  return flat;
};

const withExport = (WrappedComponent) => {
  return (props) => {
    const exportToCSV = async (data, fileName) => {
      try {
        if (!data.length) {
          alert("No data to export.");
          return;
        }

        // Flatten only the first object to define headers
        const headerMap = flattenObject(data[0]);
        const headers = Object.keys(headerMap);

        // Flatten all rows using the same header structure
        const csvRows = [
          headers.join(','),
          ...data.map(row => {
            const flatRow = flattenObject(row);
            return headers.map(h => {
              const val = flatRow[h];
              if (val === null || val === undefined) return '';
              if (typeof val === 'string') {
                const cleaned = val.replace(/\n/g, ',').replace(/"/g, '""');
                return `"${cleaned}"`;
              }
              return val;
            }).join(',');
          })
        ];

        const csvString = csvRows.join('\n');

        if (Platform.OS === 'web') {
          const blob = new Blob([csvString], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', fileName);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else if (FileSystem.cacheDirectory) {
          const fileUri = FileSystem.cacheDirectory + fileName;
          await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
          await Sharing.shareAsync(fileUri, { mimeType: 'text/csv' });
        } else {
          alert('File system not available on this platform.');
        }
      } catch (error) {
        console.error('Error exporting CSV:', error);
        alert('Failed to export CSV.');
      }
    };

    return (
      <View>
        <WrappedComponent {...props} />
        <Button
          title="Export to CSV"
          onPress={() => {
            if (props.data && props.fileName) {
              exportToCSV(props.data, props.fileName);
            } else {
              alert('No data or file name provided for export.');
            }
          }}
        />
      </View>
    );
  };
};

export default withExport;