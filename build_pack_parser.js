({
    name: "thirdparty/almond",
    include: ["formats/upload_pack_parser"],
    out: "upload_pack_parser_api.js",
    optimize: "none",
    wrap: {
        startFile: "thirdparty/start_pack_parser.frag",
        endFile: "thirdparty/end_pack_parser.frag"
    }
})