from typing import Any, Optional

from pydantic import BaseModel, Field


class ExtendContext(BaseModel):
    existingNodes: list[str] = Field(default_factory=list)
    existingEdges: list[list[str]] = Field(default_factory=list)


class ExtendRequest(BaseModel):
    prompt: str
    context: ExtendContext
    case_slug: str = Field(
        default="open-topic",
        description="学习案例 slug，用于注入领域说明与提示词上下文。",
    )


class NodeDetails(BaseModel):
    explanation: str = ""
    formula: Optional[str] = None
    animation: Optional[str] = None
    images: list[str] = Field(default_factory=list)
    code: Optional[str] = None
    links: list[dict[str, str]] = Field(default_factory=list)


class NewNode(BaseModel):
    id: str
    name: str
    year: int = 0
    category: str = ""
    description: str = ""
    details: NodeDetails = Field(default_factory=NodeDetails)


class NewEdge(BaseModel):
    source: str
    target: str
    relation: str
    label: Optional[str] = None


class NewTodo(BaseModel):
    title: str
    description: Optional[str] = None
    relatedNodeId: Optional[str] = None


class ExtendResponse(BaseModel):
    newNodes: list[NewNode] = Field(default_factory=list)
    newEdges: list[NewEdge] = Field(default_factory=list)
    newTodos: list[NewTodo] = Field(default_factory=list)


class ExplainChatMessage(BaseModel):
    role: str
    content: str


class ExplainChatRequest(BaseModel):
    nodeId: str
    nodeName: str
    currentExplanation: str = ""
    messages: list[ExplainChatMessage] = Field(default_factory=list)
    case_slug: str = Field(default="open-topic")


class ExplainChatResponse(BaseModel):
    reply: str
    applyExplanation: Optional[str] = None


class LearningCaseOut(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: str
    description: str
    sort_order: int

    model_config = {"from_attributes": True}


class LearningCaseDetailOut(LearningCaseOut):
    initial_nodes: list[dict[str, Any]] = Field(default_factory=list)
    initial_edges: list[dict[str, Any]] = Field(default_factory=list)


class GraphSnapshotCreate(BaseModel):
    case_slug: str
    name: str
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    todos: list[dict[str, Any]] = Field(default_factory=list)


class GraphSnapshotListItem(BaseModel):
    id: str
    case_slug: str
    name: str
    created_at: str
    updated_at: str


class GraphSnapshotOut(BaseModel):
    id: str
    case_slug: str
    name: str
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    todos: list[dict[str, Any]]
    created_at: str
    updated_at: str
