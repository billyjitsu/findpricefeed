const { ethers } = require("ethers");

// You'll need to set these values based on your network
const api3ServerV1Address = "0x709944a48cAf83535e43471680fDA4905FB3920a";
const airseekerRegistryAddress = "0x7B42df2563E128Ae3F68e2CFB1904808F61C8F12";
const api3ServerV1Abi = require("./abis/api3ServerV1.json");
const airSeekerRegistryAbi = require("./abis/airSeekerRegistry.json");

const provider = new ethers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");

const encodedDapiName = ethers.encodeBytes32String("ETH/USD");
console.log("Encoded Dapi Name:", encodedDapiName);

const encodedDapiNameHash = ethers.keccak256(encodedDapiName);
console.log("Encoded Dapi Name Hash:", encodedDapiNameHash);

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

async function main() {
  try {
    const dataFeedId = await api3ServerV1.dapiNameHashToDataFeedId(
      encodedDapiNameHash
    );
    console.log("Data Feed ID:", dataFeedId);

    const dataFeedDetails = await airseekerRegistry.dataFeedIdToDetails(
      dataFeedId
    );

    // Create a new AbiCoder instance
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    // Return the airnodes and templateIds
    const [airnodes, templateIds] = abiCoder.decode(
      ["address[]", "bytes32[]"],
      dataFeedDetails
    );
    console.log("\nAirnodes:");
    airnodes.forEach((airnode, index) => {
      console.log(`${index + 1}. ${airnode}`);
    });

    console.log("\nTemplate IDs:");
    templateIds.forEach((templateId, index) => {
      console.log(`${index + 1}. ${templateId}`);
    });

    console.log("\nAirnodes and their data:");
    for (let i = 0; i < airnodes.length; i++) {
      const airnode = airnodes[i];
      console.log(`\nAirnode ${i + 1}: ${airnode}`);

      try {
        // Updated API call using native fetch
        const data = await fetch(
          `https://signed-api.api3.org/public-oev/${airnode}`
        ).then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        });

        const firstEntry = Object.values(data.data)[0];
        if (firstEntry) {
          const encodedValue = firstEntry.encodedValue;
          const decodedValueWei = BigInt(encodedValue);
          const decodedValueUSD = Number(decodedValueWei) / 1e18;

          console.log(`Template ID: ${firstEntry.templateId}`);
          console.log(`Encoded Value: ${encodedValue}`);
          console.log(
            `Decoded Value: $${decodedValueUSD.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          );
        }
      } catch (error) {
        console.log(
          `Error fetching data for airnode ${airnode}:`,
          error.message
        );
      }
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
