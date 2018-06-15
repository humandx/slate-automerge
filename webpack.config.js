var path = require('path');

module.exports = {
  entry: './src/libs/slateAutomergeBridge.js',
  output: {
    filename: 'slateAutomergeBridge.js',
    library: 'SlateAutomergeBridge',
    libraryTarget: 'umd',
    path: path.resolve(__dirname, 'dist')
  },
  devtool: 'source-map',
  module: {
    rules: [
      { test: /\.js$/, exclude: /node_modules/, loader: "babel-loader" }
    ]
  }
}
