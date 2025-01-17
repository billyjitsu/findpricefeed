const { ethers } = require("ethers");

// Contract addresses
const api3ServerV1Address = "0x709944a48cAf83535e43471680fDA4905FB3920a";
const airseekerRegistryAddress = "0x7B42df2563E128Ae3F68e2CFB1904808F61C8F12";
const api3ServerV1Abi = require("./abis/api3ServerV1.json");
const airSeekerRegistryAbi = require("./abis/airSeekerRegistry.json");

const provider = new ethers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");

// Helper function to derive OEV template ID
function deriveOevTemplateId(templateId) {
    return ethers.keccak256(ethers.toBeHex(templateId));
}

// Helper function to calculate median
function calculateMedian(values) {
    if (values.length === 0) return 0;
    
    const sorted = values.sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    return sorted[middle];
}

function formatUSD(value) {
    return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

async function main() {
    try {
        // Encode ETH/USD dAPI name
        const encodedDapiName = ethers.encodeBytes32String("ETH/USD");
        console.log("Encoded Dapi Name:", encodedDapiName);

        const encodedDapiNameHash = ethers.keccak256(encodedDapiName);
        console.log("Encoded Dapi Name Hash:", encodedDapiNameHash);

        // Initialize contracts
        const api3ServerV1 = new ethers.Contract(
            api3ServerV1Address,
            api3ServerV1Abi,
            provider
        );

        const airseekerRegistry = new ethers.Contract(
            airseekerRegistryAddress,
            airSeekerRegistryAbi,
            provider
        );

        // Get data feed ID
        const dataFeedId = await api3ServerV1.dapiNameHashToDataFeedId(
            encodedDapiNameHash
        );
        console.log("Data Feed ID:", dataFeedId);

        // Get data feed details
        const dataFeedDetails = await airseekerRegistry.dataFeedIdToDetails(
            dataFeedId
        );

        // Decode the data feed details
        const abiCoder = ethers.AbiCoder.defaultAbiCoder();
        const [airnodes, templateIds] = abiCoder.decode(
            ["address[]", "bytes32[]"],
            dataFeedDetails
        );

        console.log("\nBeacons for ETH/USD:");
        
        // Array to store all valid prices
        const validPrices = [];
        // Array to store detailed price data
        const priceDetails = [];

        for (let i = 0; i < airnodes.length; i++) {
            console.log(`\nBeacon ${i + 1}:`);
            console.log(`Airnode: ${airnodes[i]}`);
            console.log(`Template ID: ${templateIds[i]}`);
            
            // Derive OEV template ID
            const oevTemplateId = deriveOevTemplateId(templateIds[i]);
            console.log(`OEV Template ID: ${oevTemplateId}`);

            try {
                // Fetch signed data
                const response = await fetch(
                    `https://signed-api.api3.org/public-oev/${airnodes[i]}`
                );
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();

                // Filter for the correct template ID
                const relevantUpdates = Object.values(data.data).filter(
                    update => update.templateId === oevTemplateId
                );

                if (relevantUpdates.length > 0) {
                    // Sort by timestamp and get the latest update
                    const latestUpdate = relevantUpdates.sort(
                        (a, b) => parseInt(b.timestamp) - parseInt(a.timestamp)
                    )[0];

                    // Decode the value
                    const decodedValueWei = BigInt(latestUpdate.encodedValue);
                    const decodedValueUSD = Number(decodedValueWei) / 1e18;

                    // Store the valid price
                    validPrices.push(decodedValueUSD);
                    // Store price details
                    priceDetails.push({
                        airnode: airnodes[i],
                        price: decodedValueUSD,
                        timestamp: new Date(parseInt(latestUpdate.timestamp) * 1000)
                    });

                    console.log(`Latest Update:`);
                    console.log(`Timestamp: ${new Date(parseInt(latestUpdate.timestamp) * 1000).toISOString()}`);
                    console.log(`Price: ${formatUSD(decodedValueUSD)}`);
                } else {
                    console.log("No matching updates found for this template ID");
                }
            } catch (error) {
                console.log(
                    `Error fetching data for airnode ${airnodes[i]}:`,
                    error.message
                );
            }
        }

        // Calculate and display median of all Beacon values
        if (validPrices.length > 0) {
            const medianPrice = calculateMedian(validPrices);
            const averagePrice = validPrices.reduce((a, b) => a + b, 0) / validPrices.length;
            
            console.log("\n=== ETH/USD Price Summary ===");
            console.log(`Number of valid price feeds: ${validPrices.length}`);
            console.log(`Median Price: ${formatUSD(medianPrice)}`);
            console.log(`Average Price: ${formatUSD(averagePrice)}`);

        } else {
            console.log("\nNo valid prices found to calculate median");
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

// Call the async function
main().catch((error) => {
    console.error("Uncaught error:", error);
    process.exit(1);
});