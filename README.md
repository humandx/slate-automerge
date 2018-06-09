## Installation instructions

`./install_packages` - to install all dependencies. This installs all dependencies along with the path-from-root branch of Automerge which is also update to date with master.

`yarn start` - to run the webserver

## How to use

After starting the development server, go to `http://localhost:3000` where you
will see various number of clients. When the "CURRENTLY LIVE SYNCING" banner is
up, all changes to any client will be broadcasted to all other clients. When the
"CURRENTLY OFFLINE" banner is up, no changes are send until the "sync" button is
clicked.

## Code
- `App.js` setups up the initial Slate and Automerge document, instantiates the clients, and acts as the network layer between the clients.
- `client.js` is the Slate client.
- `utils` folder contains most of the logic that converts operations between Slate and Automerge. In other words, it's the bridge between the two worlds.

## Behind the scenes

We keep two copies of the document: one in Slate's Immutable data structure (Slate Value) and one in Automerge's data structure (immutable JSON). Aside from the embedded functions in Slate's data structure, the structure and hierarchy of the two should be identical at all times.

Flow of when a change is made on Client A and broadcast to Client B:
1) Change is made to Client A.
2) The onChange function in Client A is fired.
* The Slate Value is stored on the client.
* The Slate Operations are transformed to Automerge JSON operations (in applySlateOperations) and applied to the Automerge document.
* If online, the Automerge changes (calculated by Automerge.getChanges) is broadcast to all other clients. If offline, the change is stored until the client goes online.

3) Client B receives an event with the changes.
* Client B's Automerge document applies the changes from Client A.
* The differences between the Client B's new and old Automerge documents are computed (using Automerge.diff).
* The differences are converted to Slate Operations (in convertAutomergeToSlateOps) and applied to Client B's Slate Value.

## Known issues:
1) Syncing multiple documents when there are large changes seems to break

## Questions / Notes / Optimizations todos
1) Can we compute the output of Automerge.diff (step 3b) from the changes received (in 3)? This would allow us to avoid doing the Automerge.diff.

## Original README below

This project was bootstrapped with [Create React App](https://github.com/facebookincubator/create-react-app). Look in that README for that README file.
