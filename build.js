({
    name: "thirdparty/almond",
    include: ["workers/api-worker-proxy"],
    out: "api-built.js",
    optimize: "none",
    wrap: {
        startFile : "thirdparty/start.frag",
        endFile : "thirdparty/end.frag"
    },
    paths: {
        "text"      : "thirdparty/text"
    }
})