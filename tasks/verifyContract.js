const FileSystem = require("fs");
const BLOCK_EXPLORER_API_URL = require("../constants/blockExplorerApi.json")

const licenseTypes = {
    "None": 1,
    "Unlicense": 2,
    "MIT": 3,
    "GNU-GPLv2": 4,
    'GNU-GPLv3': 5,
    'GNU-LGPLv2.1': 6,
    'GNU-LGPLv3': 7,
    'BSD-2-Clause': 8,
    "BSD-3-Clause": 9,
    "MPL-2.0": 10,
    "OSL-3.0": 11,
    "Apache-2.0": 12,
    "GNU-AGPLv3": 13,
    "BUSL-1.1": 14
}

function getContractInheritance(baseContractString, remainingContracts, finalObj) {
    let contractNamesInherited = baseContractString.match(/(import).*(;)/g)
    // we have reached the end of the inheritance as the base contract contains no more imports
    if (!contractNamesInherited) { return finalObj }

    // extract import names
    contractNamesInherited = contractNamesInherited.map(
        x => {
            if (x.includes('"')) {
                return (x.split(`"`)[1])
                    .split(`/`).pop()
            } else {
                return (x.split(`'`)[1])
                    .split(`/`).pop()
            }
        }
    )

    // there are more parent contracts to check, push them into final object
    let parentContracts = []
    for (const contractName of contractNamesInherited) {
        for (const contract of remainingContracts) {
            if (contract[0].includes("/" + contractName)) {
                parentContracts.push(contract)
            }
        }
    }

    // filter out contracts that we haven't added to the finalObj yet
    let remainingContractsNew = remainingContracts.filter(([k, v]) => !Object.keys(Object.fromEntries(parentContracts)).includes(k))

    // take existing contracts and the new verified parent contracts and merge into object
    let resp = {...finalObj, ...Object.fromEntries(parentContracts)}

    // go through each of the parent contracts and get inheritance
    for (const [k, v] of parentContracts) {
        resp =  {...getContractInheritance(v["content"], remainingContractsNew, finalObj), ...resp}
    }

    return resp
}

function urlEncode(putObj) {
    let formBody = [];
    for (let property in putObj) {
        let encodedKey = encodeURIComponent(property);
        let encodedValue = encodeURIComponent(putObj[property]);
        formBody.push(encodedKey + "=" + encodedValue);
    }
    return formBody.join("&");
}

function formatPutObj(baseContract, contractBuildInfo, contractDeployment, taskArgs, hre) {
    let putObj= {
        apikey: process.env[`SCAN_API_KEY_${hre.network.name}`],
        module: "contract",
        action: "verifysourcecode",
        sourceCode: JSON.stringify(contractBuildInfo["input"]),
        contractaddress: contractDeployment["address"],
        codeformat: "solidity-standard-json-input",
        contractname: `${baseContract[0]}:${taskArgs.contract}`,
        compilerversion: "v" + contractBuildInfo["solcLongVersion"],
        licenseType: licenseTypes["None"] // default to none
    }

    // specify license type if one is found in the base contract
    for (const [license, type] of Object.entries(licenseTypes)) {
        if (baseContract[1]["content"].includes(`SPDX-License-Identifier: ${license}`)) {
            putObj["licenseType"] = type
        }
    }

    if (contractBuildInfo["input"]["settings"]["optimizer"]["enabled"]) {
        putObj["optimizationUsed"] = 1
        putObj["runs"] = contractBuildInfo["input"]["settings"]["optimizer"]["runs"]
    } else {
        putObj["optimizationUsed"] = 0
    }

    let constructorAbiEncoded
    if (baseContract[1]["content"].includes("constructor(")) {
        let constructorTypes = (contractDeployment["abi"].filter(x => x["type"] && x["type"] == "constructor")[0]["inputs"]).map(x => x["type"])
        constructorAbiEncoded = ethers.utils.defaultAbiCoder.encode(constructorTypes, contractDeployment["args"])
    }

    if (constructorAbiEncoded) {
        putObj["constructorArguements"] = constructorAbiEncoded.substring(2) // misspelled in etherscans api
    }

    return putObj
}

function getBaseAndRemainingContract(contractName, contractBuildInfo) {
    const baseContract = Object.entries(contractBuildInfo["input"]["sources"]).filter(([k, v]) => k.includes(contractName))[0]
    const remainingContracts = Object.entries(contractBuildInfo["input"]["sources"]).filter(([k, v]) => !k.includes(contractName))
    return [baseContract, remainingContracts]
}


module.exports = async function (taskArgs, hre) {
    const contractName = `/${taskArgs.contract}.sol`

    // get the build files/artifacts
    const contractDeployment = JSON.parse(FileSystem.readFileSync(`./deployments/${hre.network.name}/${taskArgs.contract}.json`, "utf8"))
    // iterate the build-info to find the correct build file
    let contractBuildInfo
    FileSystem.readdirSync(`./artifacts/build-info/`).forEach(fileName => {
        const f = JSON.parse(FileSystem.readFileSync(`./artifacts/build-info/${fileName}`, "utf8"))

        let test = Object.entries(f["input"]["sources"]).filter(([k, v]) => k.includes(contractName))
        if (test[0] && test[0][0]) {
            if (test[0][0].includes(contractName)) {
                contractBuildInfo = f
            }
        }
    })
    if (!contractBuildInfo) throw `Could not find contract: ${contractName} inside of build-info!`

    console.log(`\n\nVerifying... Network: ${hre.network.name}, contractName: ${contractName}, address: ${contractDeployment["address"]}`)

    // parse and filter out the extra build files, because the verifier freaks out if too many contracts to check
    const [baseContract, remainingContracts] = getBaseAndRemainingContract(contractName, contractBuildInfo)
    contractBuildInfo["input"]["sources"] = getContractInheritance(baseContract[1]["content"], remainingContracts, Object.fromEntries([baseContract]))

    // format the put request
    const putObj = formatPutObj(baseContract, contractBuildInfo, contractDeployment, taskArgs, hre)
    const response = await fetch(`${BLOCK_EXPLORER_API_URL[hre.network.name]}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: urlEncode(putObj)
    })

    console.log(await response.json())
}