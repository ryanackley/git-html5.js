 module.exports = function(grunt) {
     grunt.initConfig({
         requirejs: {
             compileWorkerApi: {
                 options: {
                     name: "thirdparty/almond",
                     include: ["workers/api-worker-proxy"],
                     out: "api-built.js",
                     optimize: "none",
                     wrap: {
                         startFile: "thirdparty/start.frag",
                         endFile: "thirdparty/end.frag"
                     },
                     paths: {
                         "text": "thirdparty/text"
                     }
                 }
             },
             compileWorker: {
                 options: {
                     name: "thirdparty/almond",
                     include: ["workers/api-worker"],
                     out: "workers/api-worker-built.js",
                     optimize: "none",
                     wrap: {
                         startFile: "thirdparty/start_worker.frag",
                         endFile: "thirdparty/end_worker.frag"
                     }
                 }
             },

             compileNoWorker: {
                 options: {
                     name: "thirdparty/almond",
                     include: ["api"],
                     out: "api-built.js",
                     optimize: "none",
                     wrap: {
                         startFile: "thirdparty/start.frag",
                         endFile: "thirdparty/end-noworker.frag"
                     }
                 }
             }

         }

     });

     grunt.loadNpmTasks('grunt-contrib-requirejs');

     grunt.registerTask('default', ['requirejs:compileWorker', 'requirejs:compileWorkerApi']);

     grunt.registerTask('no-worker', ['requirejs:compileNoWorker'])
 }