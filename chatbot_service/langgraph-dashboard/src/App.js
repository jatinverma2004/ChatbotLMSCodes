import React, { useEffect, useState } from "react";
import ReactFlow, { Background } from "reactflow";
import "reactflow/dist/style.css";
import axios from "axios";

function App() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [activeNodes, setActiveNodes] = useState([]);

  useEffect(() => {
    axios.get("http://127.0.0.1:9100/graph-structure")
      .then(res => {
        const graph = res.data;

        const rfNodes = graph.nodes.map((n, index) => ({
          id: n.id,
          data: { label: n.label },
          position: { x: index * 250, y: 100 },
          style: {
            border: "2px solid #555",
            padding: 10,
            borderRadius: 8
          }
        }));

        const rfEdges = graph.edges.map((e, i) => ({
          id: `e${i}`,
          source: e.source,
          target: e.target,
          animated: true
        }));

        setNodes(rfNodes);
        setEdges(rfEdges);
      });
  }, []);

  const highlightNodes = (trace) => {
    setNodes(nds =>
      nds.map(node => ({
        ...node,
        style: {
          ...node.style,
          background: trace.includes(node.id) ? "#4caf50" : "#fff",
          color: trace.includes(node.id) ? "#fff" : "#000"
        }
      }))
    );
  };

  return (
    <div style={{ height: "100vh" }}>
      <ReactFlow nodes={nodes} edges={edges}>
        <Background />
      </ReactFlow>

      <button
        style={{ position: "absolute", top: 20, right: 20 }}
        onClick={() => {
          axios.post("http://127.0.0.1:9100/chat", {
            uid: "U102",
            message: "leave policy"
          }).then(res => {
            highlightNodes(res.data.trace);
          });
        }}
      >
        Run Test
      </button>
    </div>
  );
}

export default App;