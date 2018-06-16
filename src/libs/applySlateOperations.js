/**
 * This converts a Slate operation to operations that act on an Automerge
 * document. This converts the functions in
 * https://github.com/ianstormtaylor/slate/blob/master/packages/slate/src/operations/apply.js
 * to modify the Automerge JSON instead of the Slate Value.
 *
 * NOTE: The move operation in Slate is a linking op in Automerge. For now, to
 * simplify the conversion from Automerge operationsto Slate, rather than move,
 * we delete the node and re-insert a new node. This results in more Automerge
 * ops but makes it so that the reverse conversion
 * (in convertAutomerge.automergeOpInsertText) does not need to know the path
 * to the previous node. If we update Automerge to contain the path to the
 * old node, we can use the move node operation.
 */


import Automerge from "automerge"
import slateCustomToJson from "./slateCustomToJson"

const allowedOperations = [
    "add_mark", "insert_text", "remove_text", "insert_node", "split_node",
    "remove_node", "merge_node", "set_node", "move_node"
];

/**
 * @function applySlateOperations
 * @desc converts a Slate operation to operations that act on an Automerge document
 * @param {Automerge.DocSet} doc - the Automerge document
 * @param {number} doc - Automerge document id
 * @param {List} slateOperations - a list of Slate Operations
 * @param {number} clientId - (optional) Id of the client
 */
export const applySlateOperations = (docSet, docId, slateOperations, clientId) => {
    const currentDoc = docSet.getDoc(docId)
    if (currentDoc) {
        const message = clientId ? `Client ${clientId}` : "Change log"
        const docNew = Automerge.change(currentDoc, message, doc => {
            // Use the Slate operations to modify the Automerge document.
            applySlateOperationsHelper(doc, slateOperations)
        })
        docSet.setDoc(docId, docNew)
    }
}


/**
 * @function applySlateOperationsHelper
 * @desc converts a Slate operation to operations that act on an Automerge document
 * @param {Automerge.document} doc - the Automerge document
 * @param {List} operations - a list of Slate Operations
 */
const applySlateOperationsHelper = (doc, operations) => {
    operations.forEach(op => {
        if (allowedOperations.indexOf(op.type) === -1) {
            return;
        }
        const {
            path, offset, text, length, mark,
            node, position, properties, newPath
        } = op;
        const index = path[path.length - 1];
        const rest = path.slice(0, -1)
        let currentNode;
        switch (op.type) {
            case "add_mark":
                // Untested
                currentNode = assertPath(doc.note, path);
                addMark(currentNode, offset, length, mark)
                break;
            case "remove_mark":
                currentNode = assertPath(doc.note, path);
                removeMark(currentNode, offset, length, mark)
                break;
            case "set_mark":
                currentNode = assertPath(doc.note, path);
                setMark(currentNode, offset, length, mark)
                break;
            case "insert_text":
                currentNode = assertPath(doc.note, path);
                // Assumes no marks and only 1 leaf
                currentNode.leaves[0].text.insertAt(offset, text);
                break;
            case "remove_text":
                currentNode = assertPath(doc.note, path);
                // Assumes no marks and only 1 leaf
                currentNode.leaves[0].text.deleteAt(offset, text.length);
                break;
            case "split_node":
                currentNode = assertPath(doc.note, rest);
                let childOne = currentNode.nodes[index];
                let childTwo = JSON.parse(JSON.stringify(currentNode.nodes[index]));
                if (childOne.object === "text") {
                    childOne.leaves[0].text.splice(position)
                    childTwo.leaves[0].text.splice(0, position)
                } else {
                    childOne.nodes.splice(position)
                    childTwo.nodes.splice(0, position)
                }
                currentNode.nodes.insertAt(index + 1, childTwo);
                if (properties) {
                    if (currentNode.nodes[index + 1].object !== "text") {
                        let propertiesJSON = slateCustomToJson(properties);
                        Object.keys(propertiesJSON).forEach(key => {
                            if (propertiesJSON.key) {
                                currentNode.nodes[index + 1][key] = propertiesJSON.key;
                            }
                        })
                    }
                }
                break;
            case "merge_node":
                currentNode = assertPath(doc.note, rest);
                let one = currentNode.nodes[index - 1];
                let two = currentNode.nodes[index];
                if (one.object === "text") {
                    // TOFIX: This is to strip out the objectId and create a new list.
                    // Not ideal at all but Slate can't do the linking that Automerge can
                    // and it's alot of work to try to move references in Slate.
                    // See Note above.
                    let temp = JSON.parse(JSON.stringify(two.leaves[0].text))
                    // one.leaves.push(...temp)
                    one.leaves[0].text.push(...temp)
                } else {
                    // TOFIX: This is to strip out the objectId and create a new list.
                    // Not ideal at all but Slate can't do the linking that Automerge can
                    // and it's alot of work to try to move references in Slate.
                    // See Note above.
                    let temp = JSON.parse(JSON.stringify(two.nodes))
                    one.nodes.push(...temp)
                }
                currentNode.nodes.deleteAt(index, 1);
                break;
            case "insert_node":
                currentNode = assertPath(doc.note, rest);
                currentNode.nodes.insertAt(index, slateCustomToJson(node));
                break;
            case "remove_node":
                currentNode = assertPath(doc.note, rest);
                currentNode.nodes.deleteAt(index, 1);
                break;
            case "set_node":
                currentNode = assertPath(doc.note, path);
                for (let attrname in properties) {
                    currentNode[attrname] = properties[attrname];
                }
                break;
            case "move_node":
                const newIndex = newPath[newPath.length - 1]
                const newParentPath = newPath.slice(0, -1)
                const oldParentPath = path.slice(0, -1)
                const oldIndex = path[path.length - 1]

                // Remove the old node from it's current parent.
                currentNode = assertPath(doc.note, oldParentPath);
                let nodeToMove = currentNode.nodes[oldIndex];

                // Find the new target...
                if (
                    oldParentPath.every((x, i) => x === newParentPath[i]) &&
                    oldParentPath.length === newParentPath.length
                ) {
                    // Do nothing
                } else if (
                    oldParentPath.every((x, i) => x === newParentPath[i]) &&
                    oldIndex < newParentPath[oldParentPath.length]
                ) {
                    // Remove the old node from it's current parent.
                    currentNode.nodes.deleteAt(oldIndex, 1);

                    // Otherwise, if the old path removal resulted in the new path being no longer
                    // correct, we need to decrement the new path at the old path's last index.
                    currentNode = doc.note;
                    newParentPath[oldParentPath.length]--
                    newParentPath.forEach(el => {
                        currentNode = currentNode.nodes[el];
                    })

                    // TOFIX: This is to strip out the objectId and create a new list.
                    // Not ideal at all but Slate can't do the linking that Automerge can
                    // and it's alot of work to try to move references in Slate.
                    // See Note above.
                    nodeToMove = JSON.parse(JSON.stringify(nodeToMove));
                    // Insert the new node to its new parent.
                    currentNode.nodes.insertAt(newIndex, nodeToMove);
                } else {
                    // Remove the old node from it's current parent.
                    currentNode.nodes.deleteAt(oldIndex, 1);

                    // Otherwise, we can just grab the target normally...
                    currentNode = doc.note;
                    newParentPath.forEach(el => {
                        currentNode = currentNode.nodes[el];
                    })

                    // TOFIX: This is to strip out the objectId and create a new list.
                    // Not ideal at all but Slate can't do the linking that Automerge can
                    // and it's alot of work to try to move references in Slate.
                    // See Note above.
                    nodeToMove = JSON.parse(JSON.stringify(nodeToMove));
                    // Insert the new node to its new parent.
                    currentNode.nodes.insertAt(newIndex, nodeToMove);
                }
                break;
            default:
                console.log("In default case")
                break;
        }
    })
}

const assertPath = (docRoot, path) => {
    let currentNode = docRoot;
    path.forEach(el => { currentNode = currentNode.nodes[el]; })
    return currentNode;
}

const addMark = (currentNode, index, length, set) => {
    if (this.text === '') return
    if (length === 0) return
    let numberOfChars = 0
    currentNode.leaves.forEach(leaf => {numberOfChars += leaf.text.length})
    if (index >= numberOfChars) return

    const [before, bundle] = splitLeaves(currentNode.leaves, index)
    const [middle, after] = splitLeaves(bundle, length)

    set = set.toJS()
    const leaves = before.concat(middle.map(x => addMarksToLeaf(x, set)), after)
    return setLeaves(currentNode, leaves)
}

const removeMark = (currentNode, index, length, set) => {

}

const setMark = (currentNode, index, length, mark, properties) => {

}

const splitLeaves = (leaves, offset) => {
    if (offset < 0) { return [[], leaves] }
    if (leaves.length === 0) { return [[], []] }
    let endOffset = 0
    let index = -1
    let left, right

    for (let leaf of leaves) {
        index++
        const startOffset = endOffset
        const { text } = leaf
        endOffset += text.length

        if (endOffset < offset) break
        if (startOffset > offset) continue

        const length = offset - startOffset

        left = leaf
        right = JSON.parse(JSON.stringify(leaf))

        left.text = left.text.slice(0, length)
        right.text = right.text.slice(length)
        break
    }

    if (!left) return [leaves, []]
    if (left.text.length === 0) {
        if (index === 0) {
            return [[left], [right]]
        }
        return [leaves.slice(0, index), leaves.slice(index)]
    }
    if (right.text.length === 0) {
        if (index === leaves.length - 1) {
            return [[left], [right]]
        }
        return [leaves.slice(0, index + 1), leaves.slice(index + 1)]
    }
    return [[left], [right]]
}

const addMarksToLeaf = (leaf, mark) => {
    if (leaf.marks.indexOf(mark) === -1) {
        leaf.marks.push(mark)
    }
    return leaf
}

const setLeaves = (node, leaves) => {
    if (leaves.length === 1 && leaves[0].text.length === 0) {
        node.leaves = []
    } else {
        node.leaves = leaves
    }
}
