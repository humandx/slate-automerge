module.exports.initialValue = {
    "document": {
        "nodes": [
            {
                "object": "block",
                "type": "paragraph",
                "nodes": [
                    {
                        "object": "text",
                        "leaves": [
                            {
                                "text": "This is the editor. Type here."
                            }
                        ]
                    }
                ]
            },
            {
                "object": "block",
                "type": "ul_list",
                "data": {
                    "style": {
                        "listStyleType": "disc"
                    }
                },
                "nodes": [
                    {
                        "object": "block",
                        "type": "list_item",
                        "nodes": [
                            {
                                "object": "block",
                                "type": "paragraph",
                                "nodes": [
                                    {
                                        "object": "text",
                                        "leaves": [
                                            {
                                                "text": "This is node in a list. Hit [ENTER] and then hit [TAB]"
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    }
};
