import customToJSON from "./customToJson"

const allowedOperations = [
  "insert_text", "remove_text", "insert_node", "split_node",
  "remove_node", "merge_node", "set_node", "move_node"
];

export const applySlateOperations = (doc, operations) => {
  operations.forEach(op => {
    if (allowedOperations.indexOf(op.type) == -1) {
      return;
    }
    const {
      path, offset, text, length, mark,
      node, position, properties, newPath
    } = op;
    const index = path[path.length - 1];
    const rest = path.slice(0, -1)
    let currentNode = doc.note;
    let characters;
    switch (op.type) {
      case "add_mark":
        // Untested
        path.forEach(el => {
          currentNode = currentNode.nodes[el];
        })
        currentNode.characters.forEach((char, i) => {
          if (i < offset) return;
          if (i >= offset + length) return;
          const hasMark = char.marks.find((charMark) => {
            return charMark.type == mark.type
          })
          if (!hasMark) {
            char.marks.push(mark)
          }
        })
        break;
      case "remove_mark":
        // Untested
        path.forEach(el => {
          currentNode = currentNode.nodes[el];
        })
        currentNode.characters.forEach((char, i) => {
          if (i < offset) return;
          if (i >= offset + length) return;
          const markIndex = char.marks.findIndex((charMark) => {
            return charMark.type == mark.type
          })
          if (markIndex) {
            char.marks.deleteAt(markIndex, 1);
          }
        })
        break;
      case "set_mark":
        // Untested
        path.forEach(el => {
          currentNode = currentNode.nodes[el];
        })
        currentNode.characters.forEach((char, i) => {
          if (i < offset) return;
          if (i >= offset + length) return;
          const markIndex = char.marks.findIndex((charMark) => {
            return charMark.type == mark.type
          })
          if (markIndex) {
            char.marks[markIndex] = mark;
          }
        })
        break;
      case "insert_text":
        path.forEach(el => {
          currentNode = currentNode.nodes[el];
        })
        const characterNode = {
          object: "character",
          marks: [],
          text: text,
        }
        currentNode.characters.insertAt(offset, characterNode);
        break;
      case "remove_text":
        path.forEach(el => {
          currentNode = currentNode.nodes[el];
        })
        currentNode.characters.deleteAt(offset, text.length);
        break;
      case "split_node":
        rest.forEach(el => {
          currentNode = currentNode.nodes[el];
        })
        let childOne = currentNode.nodes[index];
        let childTwo = JSON.parse(JSON.stringify(currentNode.nodes[index]));
        if (childOne.object == "text") {
          childOne.characters.splice(position)
          childTwo.characters.splice(0, position)
        } else {
          childOne.nodes.splice(position)
          childTwo.nodes.splice(0, position)
        }
        currentNode.nodes.insertAt(index + 1, childTwo);
        if (properties) {
          if (currentNode.nodes[index + 1].object !== "text") {
            let propertiesJSON = customToJSON(properties);
            Object.keys(propertiesJSON).forEach(key => {
              if (propertiesJSON.key) {
                currentNode.nodes[index + 1][key] = propertiesJSON.key;
              }
            })
          }
        }
        break;
      case "merge_node":
        rest.forEach(el => {
          currentNode = currentNode.nodes[el];
        })
        let one = currentNode.nodes[index - 1];
        let two = currentNode.nodes[index];
        if (one.object == "text") {
          one.characters.push(...two.characters)
        } else {
          one.nodes.push(...two.nodes)
        }
        currentNode.nodes.deleteAt(index, 1);
        break;
      case "insert_node":
        rest.forEach(el => {
          currentNode = currentNode.nodes[el];
        })
        currentNode.insertAt(index, customToJSON(node));
        break;
      case "remove_node":
        rest.forEach(el => {
          currentNode = currentNode.nodes[el];
        })
        currentNode.deleteAt(index, 1);
        break;
      case "set_node":
        path.forEach(el => {
          currentNode = currentNode.nodes[el];
        })
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
        oldParentPath.forEach(el => {
          currentNode = currentNode.nodes[el];
        })
        let nodeToMove = currentNode.deleteAt(oldIndex, 1);

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
          // Otherwise, if the old path removal resulted in the new path being no longer
          // correct, we need to decrement the new path at the old path's last index.
          currentNode = doc.note;
          newParentPath[oldParentPath.length]--
          newParentPath.forEach(el => {
            currentNode = currentNode.nodes[el];
          })
        } else {
          // Otherwise, we can just grab the target normally...
          currentNode = doc.note;
          newParentPath.forEach(el => {
            currentNode = currentNode.nodes[el];
          })
        }

        // Insert the new node to its new parent.
        currentNode.insertAt(newIndex, nodeToMove);
        break;
    }
  })
}
