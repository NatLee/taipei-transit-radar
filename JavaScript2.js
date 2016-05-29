var _body = document.getElementsByTagName("body")[0];

function init() {
  createStationElements();

}

function createStationElements() {
  $.getJSON("https://raw.githubusercontent.com/NatLee/2016IISI-HACKATHON/gh-pages/assets/MRTstationJson.json?token=ASmQ94nvo1HJRwz3kRnda2AnZURZJsXGks5XU7yzwA%3D%3D", function (json) {
    for (var i = 0; i < json.length; i++) {
      if (!json[i]["top"])
        continue;

      var value = json[i]["latitude"] + "," + json[i]["longitude"]
      var div = document.createElement("div");
      div.setAttribute("class", "station");
      div.setAttribute("id", value);
      div.style["top"] = json[i]["top"];
      div.style["left"] = json[i]["left"];
      div.addEventListener("click", clickStation);




      _body.appendChild(div);
    }

  });
}

function clickStation(e) {
  alert(e.target.id);

}



init();
