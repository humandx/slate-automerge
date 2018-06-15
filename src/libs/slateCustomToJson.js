/**
 * This contains a custom toJSON function for Slate objects intended to copy
 * exactly the Slate value for Automerge with the exception of Text nodes.
 * The code was modified from the toJSON() methods in
 * https://github.com/ianstormtaylor/slate/tree/master/packages/slate/src/models
 *
 * Primary differences:
 * - For leaf nodes, text is changed from a string to an array of characters.
     Should use Automerge.Text nodes if possible
 * - Currently does not support marks.
 */

import Automerge from "automerge"

/**
 * @function toJSON
 * @desc Custom toJSON function for Slate data structures
 * @param {Slate.Node} value - a Slate node
 * @param {Object} options - current unused
 */
const toJSON = (value, options = {}) => {

    if (value === undefined || value === null) {
        return null;
    }

    let object = value.object;
    switch (object) {
        case "block":
            return {
                object: value.object,
                data: toJSON(value.data, options),
                isVoid: value.isVoid,
                nodes: value.nodes.toArray().map(n => toJSON(n, options)),
                type: value.type,
            }
        case "data":
            return object.toJSON();
        case "document":
            return {
                object: value.object,
                data: toJSON(value.data, options),
                nodes: value.nodes.toArray().map(n => toJSON(n, options)),
            }
        case "history":
            return {
                object: value.object,
                redos: toJSON(value.redos, options),
                undos: toJSON(value.undos, options),
            }
        case "inline":
            return {
                object: value.object,
                data: toJSON(value.data, options),
                isVoid: value.isVoid,
                nodes: value.nodes.toArray().map(n => toJSON(n, options)),
                type: value.type,
            }
        case "leaf":
            // Should convert leaf.text to an Automerge.Text object
            const automergeText = value.text.split("")
            return {
                object: value.object,
                marks: value.marks.toArray().map(m => toJSON(m, options)),
                text: automergeText,
            }
        case "mark":
            return {
                object: value.object,
                data: toJSON(value.data, options),
                type: value.type,
            }
        case "operation":
            return operationJSON(value, options)
        case "range":
            return {
                object: value.object,
                anchorKey: value.anchorKey,
                anchorOffset: value.anchorOffset,
                focusKey: value.focusKey,
                focusOffset: value.focusOffset,
                isBackward: value.isBackward,
                isFocused: value.isFocused,
                marks: value.marks === null ? null : value.marks.toArray().map(m => toJSON(m, options)),
            }
        case "schema":
            return {
                object: value.object,
                document: value.document,
                blocks: value.blocks,
                inlines: value.inlines,
            }
        case "text":
            return {
                object: value.object,
                leaves: value.leaves.toArray().map(c => toJSON(c, options))
            }
        case "value":
            return valueJSON(value, options)
        default:
            if (typeof value.toJSON === "function") {
                return value.toJSON();
            } else {
                const keys = Object.keys(value);
                let val = {}
                keys.forEach(key => {
                    if (!value.key) {
                        return;
                    }
                    if (typeof value.key.toJSON === "function") {
                        val[key] = value.key.toJSON();
                    } else {
                        val[key] = value.key;
                    }
                });
                return val;
            }
    }

}

const OPERATION_ATTRIBUTES = {
    add_mark: ['value', 'path', 'offset', 'length', 'mark'],
    insert_node: ['value', 'path', 'node'],
    insert_text: ['value', 'path', 'offset', 'text', 'marks'],
    merge_node: ['value', 'path', 'position', 'properties', 'target'],
    move_node: ['value', 'path', 'newPath'],
    remove_mark: ['value', 'path', 'offset', 'length', 'mark'],
    remove_node: ['value', 'path', 'node'],
    remove_text: ['value', 'path', 'offset', 'text', 'marks'],
    set_mark: ['value', 'path', 'offset', 'length', 'mark', 'properties'],
    set_node: ['value', 'path', 'node', 'properties'],
    set_selection: ['value', 'selection', 'properties'],
    set_value: ['value', 'properties'],
    split_node: ['value', 'path', 'position', 'properties', 'target'],
}

/**
 * @function operationJSON
 * @desc Convert an Slate Operation into JSON. This is a copy of the
 *     Operation.toJSON method except that it calls toJSON() in this file.
 */
const operationJSON = (valueOriginal, options = {}) => {
    const { object, type } = valueOriginal
    const json = { object, type }
    const ATTRIBUTES = OPERATION_ATTRIBUTES[type]

    for (const key of ATTRIBUTES) {
        let value = valueOriginal[key]

        // Skip keys for objects that should not be serialized, and are only used
        // for providing the local-only invert behavior for the history stack.
        if (key === 'document') continue
        if (key === 'selection') continue
        if (key === 'value') continue
        if (key === 'node' && type !== 'insert_node') continue

        if (key === 'mark' || key === 'marks' || key === 'node') {
            value = toJSON(value, options)
        }

        if (key === 'properties' && type === 'merge_node') {
            const v = {}
            if ('data' in value) v.data = toJSON(value.data, options)
            if ('type' in value) v.type = value.type
            value = v
        }

        if (key === 'properties' && type === 'set_mark') {
            const v = {}
            if ('data' in value) v.data = toJSON(value.data, options)
            if ('type' in value) v.type = value.type
            value = v
        }

        if (key === 'properties' && type === 'set_node') {
            const v = {}
            if ('data' in value) v.data = toJSON(value.data, options)
            if ('isVoid' in value) v.isVoid = value.isVoid
            if ('type' in value) v.type = value.type
            value = v
        }

        if (key === 'properties' && type === 'set_selection') {
            const v = {}
            if ('anchorOffset' in value) v.anchorOffset = value.anchorOffset
            if ('anchorPath' in value) v.anchorPath = value.anchorPath
            if ('focusOffset' in value) v.focusOffset = value.focusOffset
            if ('focusPath' in value) v.focusPath = value.focusPath
            if ('isBackward' in value) v.isBackward = value.isBackward
            if ('isFocused' in value) v.isFocused = value.isFocused
            if ('marks' in value)
                v.marks = value.marks === null ? null : toJSON(value.marks, options)
            value = v
        }

        if (key === 'properties' && type === 'set_value') {
            const v = {}
            if ('data' in value) v.data = value.data.toJS()
            if ('decorations' in value) v.decorations = toJSON(value.decorations)
            if ('schema' in value) v.schema = toJSON(value.schema, options)
            value = v
        }

        if (key === 'properties' && type === 'split_node') {
            const v = {}
            if ('data' in value) v.data = toJSON(value.data, options)
            if ('type' in value) v.type = value.type
            value = v
        }

        json[key] = value
    }

    return json
}

/**
 * @function valueJSON
 * @desc Convert an Slate Value into JSON. This is a copy of the Value.toJSON
 *     method except that it calls toJSON() in this file.
 */
const valueJSON = (value, options = {}) => {
    const object = {
        object: value.object,
        document: toJSON(value.document, options),
    }

    if (options.preserveData) {
        object.data = toJSON(value.data, options)
    }

    if (options.preserveDecorations) {
        object.decorations = value.decorations
            ? value.decorations.toArray().map(d => toJSON(d, options))
            : null
    }

    if (options.preserveHistory) {
        object.history = toJSON(value.history, options)
    }

    if (options.preserveSelection) {
        object.selection = toJSON(value.selection, options)
    }

    if (options.preserveSchema) {
        object.schema = toJSON(value.schema, options)
    }

    if (options.preserveSelection && !options.preserveKeys) {
        const { document, selection } = value
        object.selection.anchorPath = selection.isSet
            ? document.getPath(selection.anchorKey)
            : null
        object.selection.focusPath = selection.isSet
            ? document.getPath(selection.focusKey)
            : null
        delete object.selection.anchorKey
        delete object.selection.focusKey
    }
    return object
}

export default toJSON
