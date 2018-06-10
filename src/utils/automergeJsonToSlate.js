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

    let object = value.object;
    switch(object) {
        case "text":
            // Difficult conversion. Look in
            // slate/packages/slate/src/models/text.js -> toJSON() and getLeaves()
            newJson = value;
            newJson.leaves = getLeaves(value.characters)
            break;
        default:
            newJson = value;
            newJson.nodes = value.nodes.map((node) => {return fromJSON(node)})
            break;
    }

    return newJson;
}

export default fromJSON
