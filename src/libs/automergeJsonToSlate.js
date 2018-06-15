/**
 * This contains a custom fromJSON function for Automerge objects intended to
 * initialize as a Slate Value. This currently does not have support for marks.
 */

const createLeaf = (leaf) => {
    let newLeaf = {
        object: "leaf",
        marks: [],
        text: leaf.text.join("")
    }
    return newLeaf
}

const fromJSON = (value) => {
    if (value === undefined || value === null) {
        return null;
    }

    let newJson = {};

    Object.keys(value).forEach((key) => {
        if (Array.isArray(value[key])) {
            newJson[key] = value[key].map((node) => { return fromJSON(node) })
        } else if (typeof (value[key]) === "object") {
            newJson[key] = fromJSON(value[key])
        } else {
            newJson[key] = value[key]
        }
    })

    if (value.object === "text") {
        newJson.leaves = value.leaves.map(leaf => createLeaf(leaf))
    }

    return newJson;
}

export default fromJSON

