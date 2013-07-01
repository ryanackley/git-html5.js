({
    name: "thirdparty/almond",
    include: ["api"],
    out: "api-built.js",
    optimize: "none",
    wrap: {
        startFile : "thirdparty/start.frag",
        endFile : "thirdparty/end.frag"
    }
})