/**
 * This contains a custom fromJSON function for Automerge objects intended to
 * initialize as a Slate Value.
 * Currently NOT USED and shouldn't need to be used.
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
