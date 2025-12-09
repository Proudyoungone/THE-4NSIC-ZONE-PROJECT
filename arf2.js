/* Created by Justin Nordine, edited by Katelyn Rogers with the assistance of Chat GPT */
var margin = [20, 120, 20, 140],
    width = 1280 - margin[1] - margin[3],
    height = 800 - margin[0] - margin[2],
    i = 0,
    duration = 1250,
    root;

// global flag for search
var searchActive = false;

var tree = d3.layout.tree()
    .size([height, width]);

var diagonal = d3.svg.diagonal()
    .projection(function(d) { return [d.y, d.x]; });

var vis = d3.select("#body").append("svg:svg")
    .attr("width", width + margin[1] + margin[3])
    .attr("height", height + margin[0] + margin[2])
  .append("svg:g")
    .attr("transform", "translate(" + margin[3] + "," + margin[0] + ")");

d3.json("arf2.json", function(json) {
  root = json;
  root.x0 = height / 2;
  root.y0 = 0;

  function collapse(d) {
    if (d.children) {
      d._children = d.children;
      d._children.forEach(collapse);
      d.children = null;
    }
  }

  // start collapsed
  if (root.children) {
    root.children.forEach(collapse);
  }
  update(root);
});

function update(source) {
  // Compute the new tree layout.
  var nodes = tree.nodes(root).reverse();

  // Normalize for fixed-depth.
  nodes.forEach(function(d) { d.y = d.depth * 180; });

  // Update the nodes…
  var node = vis.selectAll("g.node")
      .data(nodes, function(d) { return d.id || (d.id = ++i); });

  // Enter any new nodes at the parent's previous position.
  var nodeEnter = node.enter().append("svg:g")
      .attr("class", "node")
      .attr("transform", function(d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
      .on("click", function(d) { toggle(d); update(d); });

  nodeEnter.append("svg:circle")
      .attr("r", 1e-6)
      .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; });

  nodeEnter.append('a')
      .attr("target", "_blank")
      .attr('xlink:href', function(d) { return d.url; })
      .append("svg:text")
      .attr("x", function(d) { return d.children || d._children ? -10 : 10; })
      .attr("dy", ".35em")
      .attr("text-anchor", function(d) { return d.children || d._children ? "end" : "start"; })
      .text(function(d) { return d.name; })
      .style("fill: rgb(0, 0, 0)", function(d) { return d.free ? 'black' : '#999'; })
      .style("fill-opacity", 1e-6);

  nodeEnter.append("svg:title")
    .text(function(d) {
      return d.description;
    });

  // Transition nodes to their new position.
  var nodeUpdate = node.transition()
      .duration(duration)
      .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; })
      .style("opacity", function(d) {
        // dim nodes that are not part of a matched branch when searching
        if (searchActive && !d.matchedBranch) {
          return 0.2;
        }
        return 1;
      });

  nodeUpdate.select("circle")
      .attr("r", 6)
      .style("fill", function(d) { return d._children ? "lightsteelblue" : "#fff"; })
      .style("stroke", function(d) {
        // neon border for exact matches
        return d.matched ? "#00e5ff" : "#ccc";
      })
      .style("stroke-width", function(d) {
        return d.matched ? 3 : 1;
      });

  nodeUpdate.select("text")
      .style("fill-opacity", 1)
      .style("font-weight", function(d) {
        return d.matched ? "bold" : "normal";
      })
      .style("fill", function(d) {
        return d.matched ? "#00e5ff" : "#000";
      });

  // Transition exiting nodes to the parent's new position.
  var nodeExit = node.exit().transition()
      .duration(duration)
      .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
      .style("opacity", 1e-6)
      .remove();

  nodeExit.select("circle")
      .attr("r", 1e-6);

  nodeExit.select("text")
      .style("fill-opacity", 1e-6);

  // Update the links…
  var link = vis.selectAll("path.link")
      .data(tree.links(nodes), function(d) { return d.target.id; });

  // Enter any new links at the parent's previous position.
  link.enter().insert("svg:path", "g")
      .attr("class", "link")
      .attr("d", function(d) {
        var o = {x: source.x0, y: source.y0};
        return diagonal({source: o, target: o});
      })
    .transition()
      .duration(duration)
      .attr("d", diagonal);

  // Transition links to their new position.
  link.transition()
      .duration(duration)
      .attr("d", diagonal)
      .style("opacity", function(d) {
        // dim links if their target node is not on a matched branch
        if (searchActive && !d.target.matchedBranch) {
          return 0.15;
        }
        return 1;
      });

  // Transition exiting nodes to the parent's new position.
  link.exit().transition()
      .duration(duration)
      .attr("d", function(d) {
        var o = {x: source.x, y: source.y};
        return diagonal({source: o, target: o});
      })
      .remove();

  // Stash the old positions for transition.
  nodes.forEach(function(d) {
    d.x0 = d.x;
    d.y0 = d.y;
  });
}

// Toggle children.
function toggle(d) {
  if (d.children) {
    d._children = d.children;
    d.children = null;
  } else {
    d.children = d._children;
    d._children = null;
  }
}

/* ===========================
   SEARCH SUPPORT FUNCTIONS
   =========================== */

// clear match flags on all nodes
function clearMatches(d) {
  d.matched = false;
  d.matchedBranch = false;
  if (d.children) {
    d.children.forEach(clearMatches);
  }
  if (d._children) {
    d._children.forEach(clearMatches);
  }
}

// recursively mark which nodes match and which branches contain a match
function markMatches(d, term) {
  var name = (d.name || "").toLowerCase();
  var url  = (d.url  || "").toLowerCase();

  var selfMatches = (term !== "") && (name.indexOf(term) !== -1 || url.indexOf(term) !== -1);
  var childMatches = false;

  if (d.children) {
    d.children.forEach(function(c) {
      if (markMatches(c, term)) {
        childMatches = true;
      }
    });
  }
  if (d._children) {
    d._children.forEach(function(c) {
      if (markMatches(c, term)) {
        childMatches = true;
      }
    });
  }

  d.matched = selfMatches;
  d.matchedBranch = selfMatches || childMatches;

  return d.matchedBranch;
}

// expand branches that contain matches (so you can see them)
function expandMatchedBranches(d) {
  // recurse first
  if (d.children) {
    d.children.forEach(expandMatchedBranches);
  }
  if (d._children) {
    d._children.forEach(expandMatchedBranches);
  }

  // if this node's branch has a match and its children are collapsed, expand them
  if (d.matchedBranch && d._children) {
    d.children = d._children;
    d._children = null;
  }
}

// main function to be called from the search input
function runTreeSearch() {
  var input = document.getElementById("searchInput");
  if (!input || !root) {
    return;
  }

  var term = input.value.trim().toLowerCase();
  searchActive = term.length > 0;

  // 1) clear existing flags
  clearMatches(root);

  if (!searchActive) {
    // no search term: just redraw in current collapsed/expanded state
    update(root);
    return;
  }

  // 2) mark matches
  markMatches(root, term);

  // 3) expand branches containing matches
  expandMatchedBranches(root);

  // 4) redraw tree with highlighting
  update(root);
}
