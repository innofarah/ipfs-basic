const ipfsClient = require('ipfs-http-client')
const fs = require('fs')
const fetch = require('node-fetch')
const ipfs = require('ipfs-http-client')
const { error } = require('console')

// connect to the default API address http://localhost:5001
const client = ipfs.create({
    host: 'localhost',
    port: 5001,
    protocol: 'http',
    method: "POST",
    headers: {
        
    }
  })
// error in allow-origin cors ... access to fetch at 'http://localhost:5001/api/v0/add?stream-channels=true&progress=false' from origin 'http://127.0.0.1:5500' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource. If an opaque response serves your needs, set the request's mode to 'no-cors' to fetch the resource with CORS disabled.
// to solve it --> change the ipfs config : add the method "POST" to "API" "HTTPHeaders" "access-control-allow-methods" [check in ubuntu ipfs node how the configuration was edited]
// does a problem arise from doing this? can someone try to access the local API ??
//const client = ipfs.create() 

const composeUrl = (fileCID) => {
    return 'http://127.0.0.1:8080/ipfs/' + fileCID
}

const getFileCIDFromURL = (url) => {
    let parts = url.split("/")
    return parts[parts.length - 1]
}

const reInitialize = (initialLines) => {
    let newInitialLines = []
    initialLines.forEach(line => {
        let tmp = line.split("\n")
        tmp.forEach(element => {
            newInitialLines.push(element)
        });        
    });
    return newInitialLines
}

const startWhile = (i, initialLines, globalimportedhashes, toImport) => {
    while (i < initialLines.length) {
        //console.log(initialLines)
        //console.log("i is " + i)
        if (!initialLines[i].match(/%IPFS INCLUDE /g)) {
            //console.log(initialLines[i])
            i += 1
        }
        else {
            let importedFileCID = initialLines[i].split(" ")[2]
            console.log(importedFileCID[importedFileCID.length - 1])
            if(importedFileCID[importedFileCID.length - 1] == "\r") {
                importedFileCID = importedFileCID.substr(0, importedFileCID.length - 1)
            }
            // import if not previously imported 
            if (!globalimportedhashes.includes(importedFileCID)) {
                globalimportedhashes.push(importedFileCID)
                toImport[importedFileCID] = i // add this file to the 'toImport' list
                console.log(toImport[importedFileCID])
            }
            else {
                initialLines[i] = ""
            }
            i += 1
        }
    // until here, we iterate the whole text and add files that need to be imported to the list 'toImport'
    // after adding them, we import them at once
        if (i == initialLines.length && Object.keys(toImport).length != 0) {
            let filesCIDS = Object.keys(toImport)
            let len = filesCIDS.length
                // import all files indicated in the list 
                // change the initialLines array to add the imported lines at the correct places
            let urls = {}
            filesCIDS.forEach(cid => {
                urls[cid] = composeUrl(cid)
            });
            //console.log(urls)
            let promiseswithkeys = {}
            Object.keys(urls).forEach(key => {
                //console.log(urls[key])
                promiseswithkeys[key] = fetch(urls[key])
            });
           
            //console.log(promiseswithkeys)
            let promises = Object.values(promiseswithkeys)
            Promise.all(promises).then((values) => {
                let texts = values.map(value => value.text().then((t) => {
                   // console.log(t)
                    //console.log(value.url)
                   // console.log(getFileNameFromURL(value.url))
                    // attach text to index of the filename in the initialLines array in a nested array
                    initialLines[toImport[getFileCIDFromURL(value.url)]] = t
                }))
                Promise.all(texts).then((finals) => {
                   // console.log(finals)
                   toImport = {}
                   initialLines = reInitialize(initialLines)
                   i = 0
                   startWhile(i, initialLines, globalimportedhashes, toImport)
                })
            })
         
        }
        else if (i == initialLines.length && Object.keys(toImport).length == 0) {
            let finalString = ""
            let j = 0
            while (j < initialLines.length) {
                finalString += initialLines[j] + "<br>"
                j += 1
            }
            //fs.writeFileSync('files/final-result.txt', finalString)
            document.getElementById("finalresult").innerHTML = finalString
        }
    }
}

const processFileStart = (fileCID) => {
    //let jsonContent = fs.readFileSync('files/catalog.txt')
    //jsonContent = JSON.parse(jsonContent)
    let globalimportedhashes = []
    let toImport = {}
    let url = composeUrl(fileCID)
    console.log("url is " + url)
    fetch(url).then((response) => {
        response.text().then( (text) => {
            let initialLines = text.split("\n")
            let i = 0
            startWhile(i, initialLines, globalimportedhashes, toImport)
            console.log("got out")
        })
    })
    .catch(error => {
        console.log("connection to ipfs gateway failed")
    })
}

const addFile = async(fileName, filePath, file) => {

    let reader = new FileReader();
    reader.addEventListener('load', async function(e) {
        let text = e.target.result;
        //const fileAdded = await client.add({path: filePath, content: text})
        const fileAdded = await client.add(text)
        console.log(fileAdded)
        const fileHash =  fileAdded.cid
        document.getElementById("uploadedHashes").innerHTML += "'" + fileName + "' --- " + fileHash + "<br>"
        return fileHash
    });
    reader.readAsText(file);
   
}

// remove this --> can't read and write to local files with javascript (not safe - the only thing that is allowed is to let a user 'choose' to upload a file)
/*const add_to_catalog = (fileName, fileHash) => {
	// add the key-value to the files catalog
    let jsonContent = fs.readFileSync('files/catalog.txt')
    jsonContent = JSON.parse(jsonContent)
    jsonContent[fileName] = fileHash.toString()
   // fs.appendFileSync('files/catalog.txt', '{"' + fileName + '":"' + fileHash + '"}');
    fs.writeFileSync('files/catalog.txt', JSON.stringify(jsonContent))
}*/

const uploadFile = async () => {

    const file = document.getElementById("fileinput").files[0]
    const fileName = file.name
    const filePath = "files/" + fileName
    const fileHash = await addFile(fileName, filePath, file)
     
     //add_to_catalog(fileName, fileHash) -- removed
     // --> let the user choose to save the hashes by himself to some place
}

const processFile = () => {
    const fileCID = document.getElementById("cid").value
    processFileStart(fileCID)
}

document.getElementById("upload").addEventListener("click", uploadFile);
document.getElementById("process").addEventListener("click", processFile);