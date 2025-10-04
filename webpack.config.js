const createExpoWebpackConfigAsync = require("@expo/webpack-config");

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Customize the config:
  // - Ensure specific packages are transpiled by Babel.
  config.module.rules.push({
    test: /\.js$/,
    loader: 'babel-loader',
    include: [
      /node_modules\/react-native-web\//,
      /node_modules\/react-native-vector-icons\//,
    ],
  });

  config.resolve.alias = { 'd3-time': require.resolve('d3-time/index.js'),
      'd3-time-format': require.resolve('d3-time-format/src/index.js'),
      ...config.resolve.alias
  };

  return config;
};