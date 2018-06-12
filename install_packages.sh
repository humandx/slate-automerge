# Clear old packages
rm -Rf node_modules/ yarn.lock
# rm -Rf node_modules/ tmp/ yarn.lock

# Make tmp directory for custom git repos
# mkdir -p tmp
# cd tmp

# # Download the path-from-root branch of Automerge locally
# echo "Installing automerge locally ..."
# git clone -b path-from-root --single-branch git@github.com:humandx/automerge.git
# cd automerge
# git pull
# yarn install
# yarn build
# cd ..

# Install all normal dependencies
# cd ..
yarn install
