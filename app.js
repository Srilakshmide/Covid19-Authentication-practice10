const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let database = null;

const initializesDbServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializesDbServer();

//API 1 User login
//unregistered user tries to login
//user provides an incorrect password
//Successful login of the user (jwt token)

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userDetailsQuery = `SELECT * FROM user WHERE username='${username}';`;
  const userDetails = await database.get(userDetailsQuery);
  if (userDetails !== undefined) {
    const isPasswordMatch = await bcrypt.compare(
      password,
      userDetails.password
    );
    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sing(payload, "sri_secret_key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

//Authentication Token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "sri_secret_key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 2 list of all states in the state table
const convertToDbResponseOfState = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStatesQuery = `SELECT * FROM state`;
  const statesArray = await database.all(getAllStatesQuery);
  response.send(
    statesArray.map((eachItem) => convertToDbResponseOfState(eachItem))
  );
});

// API 3 Returns a state based on the state ID
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateDetailsQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const stateQueryResponse = await database.get(getStateDetailsQuery);
  response.send(convertToDbResponseOfState(stateQueryResponse));
});

//API 4 Create a district in the district table
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrictQuery = `INSERT INTO 
    district(district_name,state_id,cases,cured,active,deaths)
    VALUES('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}');`;
  const addDistrictQueryResponse = await database.run(addDistrictQuery);
  response.send("District Successfully Added");
});

// API 5 Returns a district based on the district ID
const convertToDbResponseOfDistrict = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictDetailsQuery = `SELECT * FROM district WHERE district_id=${districtId};`;
    const districtQueryResponse = await database.get(getDistrictDetailsQuery);
    response.send(convertToDbResponseOfDistrict(districtQueryResponse));
  }
);

//API 6 Deletes a district from the district table based on district ID
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id=${districtId};`;
    const deleteResponse = await database.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 7 Updates the details of a specific district based on district ID
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `UPDATE district SET
        district_name='${districtName}',
        state_id='${stateId}',
        cases='${cases}',
        cured='${cured}',
        active='${active}',
        deaths='${deaths}' WHERE district_id=${districtId};`;
    const updateDistrictQueryResponse = await database.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 8 statistics of total cases, cured, active, deaths of a specific state
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatisticsQuery = `SELECT 
    SUM(cases) AS totalCases, SUM(cured) AS totalCured, 
    SUM(active) AS totalActive, SUM(deaths) AS totalDeaths 
    FROM district WHERE state_id = ${stateId};`;
    const statisticsQueryResponse = await database.get(getStatisticsQuery);
    response.send(statisticsQueryResponse);
  }
);

module.exports = app;
