import DOM from "./dom";
import Contract from "./contract";
import "./flightsurety.css";
import Axios from "axios";
import $ from "jquery";
import "node-snackbar/dist/snackbar.css";
import Snackbar from "node-snackbar";

const axios = Axios.create({
    baseURL: "http://localhost:3000/api/",
    timeout: 15000,
});

(async() => {
    let contract = new Contract("localhost", async () => {
        await contract.registerEvents((message) => {
             display(message.topic, message.title, [{label: message.title, error: message.error, value: message.data}]);
        });

        let flights = contract.fetchFlights();
        displayOracleForm(flights);
        displayInsuranceForm(flights);
        displayAmIInsured(flights);


        DOM.elid("check-operational-status").addEventListener("click", async () => {
            // Read transaction
            await contract.isOperational((error, result) => {
                console.log(error, result);
                display("Operational Status", "Check if contract is operational", [{label: "Operational Status", error: error, value: result}]);
            });
        });

        // User-submitted transaction
        DOM.elid("submit-oracle").addEventListener("click", async () => {
            let flight = DOM.elid("flight-number").value;

            // do nothing
            if (flight === "-1") return;
            console.log(flight);

            // Write transaction
            await contract.fetchFlightStatus(flight, (error, result) => {
                display("Oracles", "Trigger oracles", [{label: "Fetch Flight Status", error: error, value: result}]);
            });
        });

        DOM.elid("buy-insurance").addEventListener("click", async () => {
            let flight = DOM.elid("insurance-flights").value;
            let insurance = parseFloat($("#amount").val(), 10);

            console.log(flight);
            console.log(insurance);

            // do nothing
            if (flight === "-1") return;

            let found = false;
            for (let f of flights) {
                if (f.name === flight) {
                    found = true;
                }
            }
            if (!found) {
                display("Insurance", "Buy Insurance", [{label: "Insurance", error: "Invalid flight", value: null}]);
            }
            if (isNaN(insurance)) {
                display("Insurance", "Buy Insurance", [{label: "Insurance", error: "Invalid amount", value: null}]);
                return;
            }

            await contract.buyInsurance(flight, insurance, (error, result) => {
                display("Insurance", "Buy Insurance", [{label: "Insurance", error: error, value: result}]);
            });
        });

        DOM.elid("submit-ami").addEventListener("click", async () => {
            let flight = DOM.elid("flight-number-insured").value;

            // do nothing
            if (flight === "-1") return;
            console.log(flight);

            // Write transaction
            await contract.insuredAmount(flight, (error, result) => {
                display("Insurance", "Amount Insured", [{label: "Amount Insured", error: error, value: result}]);
            });
        });

        DOM.elid("request-payment").addEventListener("click", async () => {
            // Write transaction
            await contract.payPassenger((error, result) => {
                display("Insurance", "Amount Transferred", [{label: "Amount Transferred", error: error, value: result}]);
            });
        });
    });

    function displayOracleForm(flights)
    {
        $("#flight-number").find("option").remove().end().append($("<option />").val("-1").text("Select Flight..."));
        for (let flight of flights) {
            $("#flight-number").append($("<option />").val(flight.name).text(`${flight.name}: ${flight.from} to ${flight.to}`));
        }
    }


    function displayInsuranceForm(flights)
    {
        $("#insurance-flights").find("option").remove().end().append($("<option />").val("-1").text("Select Flight..."));
        for (let flight of flights) {
            $("#insurance-flights").append($("<option />").val(flight.name).text(`${flight.name}: ${flight.from} to ${flight.to}`));
        }
    }

    function displayAmIInsured(flights)
    {
        $("#flight-number-insured").find("option").remove().end().append($("<option />").val("-1").text("Select Flight..."));
        for (let flight of flights) {
            $("#flight-number-insured").append($("<option />").val(flight.name).text(`${flight.name}: ${flight.from} to ${flight.to}`));
        }
    }


})();

function display(title, description, results)
{
    for (let result of results) {
        console.log(result);
        if (result.error) {
            console.log("error");
            Snackbar.show({text: `${result.label}: ` + result.error, pos: "bottom-center", textColor: "#ff3366"});
        } else {
            Snackbar.show({text: `${result.label}: ` + result.value, pos: "bottom-center", duration: 2000});
        }
    }
}

// eof
