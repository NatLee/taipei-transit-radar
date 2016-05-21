var _body = document.getElementsByTagName("body")[0];

function init() {
  $("#change")[0].addEventListener("click", changeEvent);
  $("#search")[0].addEventListener("click", searchEvent);

}

function detectBrowser() {
  var sAgent = navigator.vendor;
  this.isIE = (sAgent.indexOf("msie") != -1); //IE6.0-7
  this.isFF = (sAgent.indexOf("firefox") != -1);//firefox
  this.isSa = (sAgent.indexOf("safari") != -1);//safari
  this.isOp = (sAgent.indexOf("opera") != -1);//opera
  this.isNN = (sAgent.indexOf("netscape") != -1);//netscape
  this.isCh = (sAgent.indexOf("chrome") != -1);//chrome
  this.isMa = this.isIE;//marthon
  this.isOther = (!this.isIE && !this.isFF && !this.isSa && !this.isOp && !this.isNN && !this.isSa);//unknown Browser

  var oBrowser = new detectBrowser();
  if (oBrowser.isIE) {
    alert("IE6.0/7.0(or above version).");
  }
  if (oBrowser.isSa && !oBrowser.isCh) {
    alert("Safari.");
  }
  if (oBrowser.isOp) {
    alert("Opera.");
  }
  if (oBrowser.isCh && oBrowser.isSa) {
    alert("Chrom.");
  }
  if (oBrowser.isFF) {
    alert("FireFox.");
  }
}

function changeEvent(e) {
  var startValue = $("#start")[0].value;
  var endValue = $("#end")[0].value;

  $("#start")[0].value = endValue;
  $("#end")[0].value = startValue;




  //$("#start")[0].value(end);
  //$("#end")[0].value(start);
}


function searchEvent(e) {
  $("#showValue")[0].innerHTML = "";

  //callGoogleServer("TRANSIT", "BUS");
  //callGoogleServer("TRANSIT", "RAIL");
  callGoogleServer("WALKING", "WALK");



}

function callGoogleServer(classTran, type) {
  var startValue = $("#start")[0].value;
  var endValue = $("#end")[0].value;

  var directionsService = new google.maps.DirectionsService();
  var directionsRequest = {
    origin: startValue,
    destination: endValue,
    travelMode: google.maps.DirectionsTravelMode[classTran],
    optimizeWaypoints: true,
    unitSystem: google.maps.UnitSystem.METRIC
  };

  if (classTran == "TRANSIT") {
    directionsRequest["transitOptions"] = {
      modes: [google.maps.TransitMode[type]]
    };
  }

  var json_bus, json_tram, temp_bus

  directionsService.route(directionsRequest, function (response, status) {
    if (status == google.maps.DirectionsStatus.OK) {
      temp = response["routes"][0];

      var dis = 0;
      for (var i = 0; i < temp["legs"].length; i++) {
        dis += temp["legs"][i]["distance"]["value"];
      }
      dis = dis / 1000;


      var steps = temp["legs"][0]["steps"];
      var stepString = "";
      for (var i = 0; i < steps.length; i++) {
        if (steps[i]["transit"] && steps[i]["transit"]["line"]) {
          if (steps[i]["transit"]["line"]["name"])
            stepString += steps[i]["transit"]["line"]["name"];
          if (steps[i]["transit"]["line"]["short_name"])
            stepString += "(" + steps[i]["transit"]["line"]["short_name"] + ")";
        }
      }
      if (type == "WALK" && stepString == "")
        stepString = "腳";


      if (type == "BUS")
        type = "公車";
      else if (type == "RAIL")
        type = "捷運";
      else
        type = "走路";


      var cost = "TWD $0";
      if (temp["fare"] && temp["fare"]["currency"])
        cost = temp["fare"]["currency"] + " " + temp["fare"]["text"];


       
      var departure = new Date().toLocaleString().split(' ')[1];
      //if(navigator.userAgent.match(/Android|iPhone|iPad/i) 

      //detectBrowser();
      var sAgent = navigator.vendor;
      if (sAgent.indexOf("Apple") > -1)
        alert("apple");

      //alert(new Date().toLocaleString());
      departure = getViewDate(departure);
      if (temp["legs"][0]["departure_time"] && temp["legs"][0]["departure_time"]["text"])
        departure = temp["legs"][0]["departure_time"]["text"];

      var arrived = addMins(temp["legs"][0]["duration"]["value"]).toLocaleString().split(' ')[1];
      arrived = getViewDate(arrived);
      if (temp["legs"][0]["arrival_time"] && temp["legs"][0]["arrival_time"]["text"])
        arrived = temp["legs"][0]["arrival_time"]["text"]


      $("#showValue")[0].innerHTML += "</br>大眾交通工具：" + type +
        "</br>搭乘車號：" + stepString +
        "</br>花費金額：" + cost +
        "</br>出發時間：" + departure +
        "</br>抵達時間：" + arrived +
        "</br>距離總長：" + dis + " 公里</br>";
    }
    else
      alert("Unable to retrieve your route");
  });
}

function getViewDate(d) {
  var ary = d.split(':');
  return ary[0] + ":" + ary[1];
}

function addMins(min) {
  var d = new Date().getTime();

  return new Date(d + min * 1000);
}


function createCORSRequest(method, url) {
  var xhr = new XMLHttpRequest();
  if ("withCredentials" in xhr) {

    // Check if the XMLHttpRequest object has a "withCredentials" property.
    // "withCredentials" only exists on XMLHTTPRequest2 objects.
    xhr.open(method, url, true);

  } else if (typeof XDomainRequest != "undefined") {

    // Otherwise, check if XDomainRequest.
    // XDomainRequest only exists in IE, and is IE's way of making CORS requests.
    xhr = new XDomainRequest();
    xhr.open(method, url);

  } else {

    // Otherwise, CORS is not supported by the browser.
    xhr = null;

  }
  return xhr;
}




function init_D3js() {
  var diameter = 960,
    format = d3.format(",d"),
    color = d3.scale.category20c();

  var bubble = d3.layout.pack()
      .sort(null)
      .size([diameter, diameter])
      .padding(1.5);

  var svg = d3.select("body").append("svg")
      .attr("width", diameter)
      .attr("height", diameter)
      .attr("class", "bubble");

  d3.json("flare.json", function (error, root) {
    if (error) throw error;

    var node = svg.selectAll(".node")
        .data(bubble.nodes(classes(root))
        .filter(function (d) { return !d.children; }))
      .enter().append("g")
        .attr("class", "node")
        .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });

    node.append("title")
        .text(function (d) { return d.className + ": " + format(d.value); });

    node.append("circle")
        .attr("r", function (d) { return d.r; })
        .style("fill", function (d) { return color(d.packageName); });

    node.append("text")
        .attr("dy", ".3em")
        .style("text-anchor", "middle")
        .text(function (d) { return d.className.substring(0, d.r / 3); });
  });

  // Returns a flattened hierarchy containing all leaf nodes under the root.
  function classes(root) {
    var classes = [];

    function recurse(name, node) {
      if (node.children) node.children.forEach(function (child) { recurse(node.name, child); });
      else classes.push({ packageName: name, className: node.name, value: node.size });
    }

    recurse(null, root);
    return { children: classes };
  }

  d3.select(self.frameElement).style("height", diameter + "px");
}





init();
//init_D3js();