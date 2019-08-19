import DOM from "./dom";
import Contract from "./contract";
import "./flightsurety.css";
import Axios from "axios";
import $ from "jquery";

const axios = Axios.create({
    baseURL: "http://localhost:3000/api/",
    timeout: 15000,
});

(async() => {
    let result = null;

    // $("#buy-insurance-section").hide();

    let done = new Set();

    let contract = new Contract("localhost", async () => {
        let flights = contract.fetchFlights();
        displayInsuranceForm(flights);

        DOM.elid("check-operational-status").addEventListener("click", async () => {
            // Read transaction
            await contract.isOperational((error, result) => {
                console.log(error, result);
                display("Operational Status", "Check if contract is operational", [ { label: "Operational Status", error: error, value: result} ]);
            });
        });

        // setup
        DOM.elid("setup-airlines").addEventListener("click", async () => {
            try {
                let response = await axios.post("/airlines", {});

                display("Airlines", "Airline Status", [{label: "Airline Status", error: null, value: response.data.events}]);
                done.add("airlines");
                if (done.size == 3) displayInsuranceForm(flights);
            }
            catch (e) {
                display("Airlines", "Airline Status", [{label: "Airline Status", error: e, value: null}]);
            }
        });

        DOM.elid("setup-oracles").addEventListener("click", async () => {
            try {
                let response = await axios.post("/oracles", {});
                display("Oracles", "Oracle Status", [{label: "Oracle Status", error: null, value: response.data.events}])
                done.add("oracles");
                if (done.size == 3) displayInsuranceForm(flights);
            }
            catch (e) {
                display("Oracles", "Oracle Status", [{label: "Oracle Status", error: e, value: null}]);
            }
        });


        DOM.elid("setup-flights").addEventListener("click", async () => {
            try {
                let response = await axios.post("/flights", {});
                display("Flights", "Flight Status", [{label: "Flight Status", error: null, value: response.data.events}])
                done.add("flights");
                if (done.size == 3) displayInsuranceForm(flights);

            }
            catch (e) {
                display("Flights", "Flight Status", [{label: "Flight Status", error: e, value: null}]);
            }
        });

        // User-submitted transaction
        DOM.elid("submit-oracle").addEventListener("click", async () => {
            let flight = DOM.elid("flight-number").value;
            // Write transaction
            await contract.fetchFlightStatus(flight, (error, result) => {
                display("Oracles", "Trigger oracles", [ { label: "Fetch Flight Status", error: error, value: result.flight + " " + result.timestamp} ]);
            });
        })

        DOM.elid("buy-insurance").addEventListener("click", () => {
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
                display("Insurance", "Buy Insurance", [ { label: "Insurance", error: "Invalid flight", value: null} ]);
            }
            if (isNaN(insurance)) {
                display("Insurance", "Buy Insurance", [ { label: "Insurance", error: "Invalid amount", value: null} ]);
                return;
            }
        });

    });

    function displayInsuranceForm(flights)
    {
        $("#insurance-flights").find("option").remove().end().append($("<option />").val("-1").text("Select Flight..."));
        for (let flight of flights) {
            $("#insurance-flights").append($("<option />").val(flight.name).text(`flight ${flight.name} on ${flight.address}`));
        }
        $("#buy-insurance-section").show();
    }


})();

function serverResponse(msg) {
    console.log(msg.data);
}


function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    console.log(results);
    results.forEach((result) => {
        let row = section.appendChild(DOM.div({className:"row"}));
        row.appendChild(DOM.div({className: "col-sm-4 field"}, result.label));
        if (result.error) {
            row.appendChild(DOM.div({className: "col-sm-8 field-value"}, String(result.error)));
        } else {
            if (typeof(result.value) === "object") {
                for (let v of result.value) {
                    row.appendChild(DOM.div({className: "col-sm-12 field-value"}, String(v)));
                }
            } else {
                row.appendChild(DOM.div({className: "col-sm-12 field-value"}, String(result.value)));
            }
        }
        section.appendChild(row);
    })
    displayDiv.append(section);
}
