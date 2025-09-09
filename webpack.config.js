const createExpoWebpackConfigAsync = require("@expo/webpack-config");
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Aggressively transpile problematic node_modules
  config.module.rules.push({
    test: /\.m?js$/,
    include: [
      path.resolve(__dirname, 'node_modules/react-native-web'),
      path.resolve(__dirname, 'node_modules/react-native-vector-icons'),
      path.resolve(__dirname, 'node_modules/@react-native'),
    ],
    use: {
      loader: 'babel-loader',
      options: {
        presets: ['babel-preset-expo'],
      },
    },
  });

  return config;
};