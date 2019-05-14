module.exports = {
  lintOnSave: false,
  devServer: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        // target: 'http://49.4.14.158:4000',
        pathRewrite: {
          "^/api": ""
        },
        changeOrigin: true
      }
    }
  }
};
