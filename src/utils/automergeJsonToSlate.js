/**
 * This contains a custom fromJSON function for Automerge objects intended to
 * initialize as a Slate Value.
 * This will not be needed once the PR related to
 * https://github.com/ianstormtaylor/slate/issues/1813 is completed.
 */


const fromJSON = (automergeJson) => {
    if (value === undefined || value === null) {
        return null;
    }

    let object = value.object;
    switch(object) {
        case "text":
            // Difficult conversion. Look in
            // slate/packages/slate/src/models/text.js -> toJSON() and getLeaves()
            break;
        default;

            break;
    }
}
