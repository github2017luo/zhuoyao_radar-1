var path = require('path');
var webpack = require('webpack');
var webpackConfig = require('./webpack.dev.conf');
const WebpackDevServer = require('webpack-dev-server');

// 遍历每个entry，加入dev-server client
Object.keys(webpackConfig.entry).forEach(function(name) {
  let _devServer = `webpack-dev-server/client?http://0.0.0.0:3000`;
  webpackConfig.entry[name] = [_devServer].concat(webpackConfig.entry[name]);
});

var compiler = webpack(webpackConfig);

const devServerOptions = {
  disableHostCheck: true,
  host: '0.0.0.0',
    proxy: {
        "/api": {
            target: "http://0.0.0.0:3001",
            // changeOrigin是关键，如果不加这个就无法跳转请求
            changeOrigin: true,
        }
    },
};

WebpackDevServer.addDevServerEntrypoints(webpackConfig, devServerOptions);
const devServer = new WebpackDevServer(compiler, devServerOptions);
devServer.listen(3000, '0.0.0.0', () => {
  console.log(`Starting server ...`);
});
