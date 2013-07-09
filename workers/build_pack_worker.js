({
    baseUrl: "../",
    name: "thirdparty/almond",
    include: ["workers/api-worker"],
    out: "api-worker-built.js",
    optimize: "none",
    wrap: {
        startFile: "../thirdparty/start_worker.frag",
        endFile: "../thirdparty/end_worker.frag"
    }
})