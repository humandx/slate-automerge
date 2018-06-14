/**
 * This contains a custom fromJSON function for Automerge objects intended to
 * initialize as a Slate Value.
 * This will not be needed once the PR related to
 * https://github.com/ianstormtaylor/slate/issues/1813 is completed.
 */

const getLeaves = (characterList) => {
    let leaves = [];
    let text = ""
    characterList.forEach((character) => {
        text = text.concat(character.text)
    })
    let leaf = {
        object: "leaf",
        marks: [],
        text: text
    }
    leaves.push(leaf)
    return leaves
}

const fromJSON = (value) => {
    if (value === undefined || value === null) {
        return null;
    }

    let newJson = {};

    Object.keys(value).forEach((key) => {
        if (Array.isArray(value[key])) {
            newJson[key] = value[key].map((node) => {return fromJSON(node)})
        } else if (typeof(value[key]) === "object") {
            newJson[key] = fromJSON(value[key])
        } else {
            newJson[key] = value[key]
        }
    })

    if (value.object === "text") {
        newJson.leaves = getLeaves(value.characters)
    }

    return newJson;
}

export default fromJSON

