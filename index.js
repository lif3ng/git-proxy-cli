const WebSocket = require('ws');
const fs = require('fs');
const tar = require('tar')
const path = require('path')
const download = require('download');
const { servers } = require('./config.json')

let i = 0;
const getServer = () => {
    const { protocol, host } = new URL(servers[i])
    const wsURL = `${protocol === 'http:' ? 'ws' : 'wss'}://${host}/wss`
    i = (i + 1) % servers.length
    return { staticServerBaseURL: `${protocol}//${host}`, wsURL }
}

const urlToDownload = process.argv[2]
const targetPath = process.argv[3]
const repoReResult = urlToDownload.match(/\/([\w-]+).git/)
const repoName = repoReResult ? repoReResult[1] : null

if (!targetPath) {
    if (fs.existsSync(path.resolve(repoName))) {
        console.log(`path: [${path.resolve(repoName)}] has exists. Please enter the specified directory.`)
        process.exit(0)
    }
} else {
    console.log(fs.existsSync(path.resolve(targetPath)))
    if (fs.existsSync(path.resolve(targetPath))) {
        console.log(`path: [${path.resolve(targetPath)}] has exists. Please re-enter the specified directory.`)
        process.exit(0)
    }
}

const { staticServerBaseURL, wsURL } = getServer()
console.log(`Connecting ${wsURL}`)
const ws = new WebSocket(wsURL)
const send = (data) => {
    ws.send(JSON.stringify(data))
}
ws.on('open', () => {
    send({ type: '2' })
    send({ url: urlToDownload })
    console.log(`Download url: ${urlToDownload}`)
})

ws.on('error', ({ code, address }) => {
    console.log('error', code, address)
})
ws.on('message', (m) => {
    try {
        const { msg, data: { sta, url } } = JSON.parse(m)
        // console.log(msg, sta)
        if (sta === 1 || sta === 2) {
            console.log(msg)
        } else if (sta === 3) {
            ws.close()
            dl(`${staticServerBaseURL}${url}`)

        }
    } catch (e) {
    }
})

const dl = async (url) => {
    console.log('download start', url)
    await download(url, '.');
    const filename = url.match(/[^/]+.tar$/)[0]
    const dirname = filename.match(/[^.]+/)[0]
    const targetDir = targetPath || repoName
    console.log(`download done: ${filename}`)
    tar.x({ file: filename }).then(() => {
        fs.unlinkSync(path.resolve(filename))
        fs.renameSync(path.resolve(dirname), path.resolve(targetDir))

        console.log(`Clone Success.\nYou can run:
        cd ${targetDir}
        git remote -v
        git log`)
    })
}