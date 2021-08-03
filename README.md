# What is git-html5.js?

git-html5.js is a pure javascript git client library. It implements a complete Git workflow in nothing but javascript. It's meant to run in a browser environment and depends on so-called "html5" API's. Some example use cases:

- Browser based code editors
- Browser devtools
- ChromeOS/FirefoxOS system tools
- ChromeOS/FirefoxOS applications that require git support

The api requires the ability to make cross-origin XHR requests. This usually means a browser extension but theoretically there could be a git hosting service that supports [CORS](http://www.w3.org/TR/cors/). git-html5.js also depends on the [FileSystem api](http://www.html5rocks.com/en/tutorials/file/filesystem/). This means that for now it only works with Chrome and Opera. There is a [FileSystem polyfill](https://github.com/ebidel/idb.filesystem.js) for Firefox but I haven't tested to see if this would work with git-html5.js

# Demo
The previous demo was a chrome app based text editor. This demo no longer works and Chrome is deprecating chrome apps. I'm working on a new demo project. In the meantime, you can run the tests against an empty repo to see it in action. See Tests section below.

# Downloading

The repo includes a built version of the api. Download [api-built.js](https://raw.github.com/ryanackley/git-html5.js/master/api-built.js).

## Building

You can also clone the repo and build it yourself. You'll need [Node](http://nodejs.org/download/) and [Grunt](http://gruntjs.com/) to manually build it. Once you have Node and Grunt installed, you would do something like

```
git clone https://github.com/ryanackley/git-html5.js.git
cd git-html5.js
npm install
grunt
``` 

The default build of the api uses a webworker to handle the api calls. If you want don't want to use webworkers for api calls, you'll need to build using
```
grunt no-worker
```

## Tests
 
The tests are run as a qunit test page inside a chrome packaged app. Load the root source directory as an unpacked extension in Chrome, then launch the packaged app in your browser. You'll need to point the test page at an empty git repository to run.  


# Known Issues and Limitations

This is a first version so there are some limitations

- **Do not work with a remote git repo that is very important and dear to you. While very unlikely, it's possible that there is some horrendous bug that could cause permanent data loss. You've been warned.**
- It's recommended that you use a depth of 1 when cloning a repo since there is no way to access commit history via the api.
- The api only supports fast-forward merges. For more info see the section below on branching
- If you try to work with a git repo the size of say WebKit or the Chromium project, you're gonna have a bad time. The library works well with small to medium size repos.
- Supports bitbucket repos but you may run into problems with github. Try logging out of Github and clearing cookies if the tests fail. 
- Only works with remote git repos that support the smart protocol over http or https 
- Only supports basic authentication

# API quick start

For brevity in the documentation, I'm ommitting code that would be used to access the sandboxed filesystem. Instead, you can assume that the code examples below are wrapped with the following code block

```javascript
// To obtain a reference to a directory named "projectHome" under the root filesystem directory you would use the following code.
window.requestFileSystem(window.PERSISTENT, 5*1024*1024*1024, function(fs){
    fs.root.getDirectory('projectHome', {create:true}, function(projectHome){
        // git-html5.js function calls go here.
    });
});
```

## Cloning a remote git repo into a your browser-based filesystem

```javascript
var options = {
    dir: projectHome,
    url: 'https://github.com/ryanackley/git-html5.js.git',
    depth: 1
};

GitApi.clone(options, function(){ 
    // clone has completed at this point, do something with the files that have been imported into dir
});
```

## Committing a local change into your local git repo

git-html5.js doesn't have an equivalent to the 'git add' command. Instead, when you call commit, it does an implicit add of all changes. This includes previously untracked files.  

```javascript
var options = {
    dir: projectHome,
    name: 'Ryan Ackley',
    email: 'ryanackley@gmail.com',
    commitMsg: 'commit message'
};

GitApi.commit(options, function(){
    // commit completed at this point
});
```

## Pushing your local commits to the remote git repo

```javascript
GitApi.push({dir: projectHome}, function(){
    // push completed at this point
});
```

## Pulling changes from your remote git repo

At the moment, only fast forward pulls are supported. To workaround this see Branching below.

```javascript
GitApi.pull({dir: projectHome}, function(){
    // the pull is complete at this point
});
```

## Branching your local repo

Because the api only supports fast-forward pulls, it's possible to get in a situation where you can't push your current branch back to the remote git repo. In these cases, you'll need to create a local branch, do a checkout the new branch, then push your local branch to the remote.

```javascript
GitApi.branch({dir: projectHome, branch: 'testBranch'}, function(){
    GitApi.checkout({dir: projectHome, branch: 'testBranch'}, function(){  
        // checkout complete, do a push here
    });
});
``` 

## Complete API documentation

See the [JSDoc generated documentation](http://ryanackley.github.io/git-html5.js/module-GitApi.html)

# License

Copyright (c) 2013 Ryan Ackley. All rights reserved.
 
Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"), 
to deal in the Software without restriction, including without limitation 
the rights to use, copy, modify, merge, publish, distribute, sublicense, 
and/or sell copies of the Software, and to permit persons to whom the 
Software is furnished to do so, subject to the following conditions:
 
The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.
 
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
DEALINGS IN THE SOFTWARE.
