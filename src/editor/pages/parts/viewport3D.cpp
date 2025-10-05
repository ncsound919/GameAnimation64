/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#include "viewport3D.h"

#include "imgui.h"
#include "ImViewGuizmo.h"
#include "../../../context.h"
#include "../../../renderer/scene.h"
#include "SDL3/SDL_gpu.h"

namespace
{
  constinit uint32_t nextPassId{0};

  std::vector<Renderer::Vertex> vertices{};
  Renderer::VertBuffer *vertBuff{nullptr};
}

Editor::Viewport3D::Viewport3D()
{
  passId = ++nextPassId;
  ctx.scene->addRenderPass(passId, [this](SDL_GPUCommandBuffer* cmdBuff, SDL_GPUGraphicsPipeline* pipeline) {
    onRenderPass(cmdBuff, pipeline);
  });
  ctx.scene->addCopyPass(passId, [this](SDL_GPUCommandBuffer* cmdBuff, SDL_GPUCopyPass *copyPass) {
    onCopyPass(cmdBuff, copyPass);
  });

  vertices.clear();
  vertices.push_back({0.0f, 0.5f, 0.0f, 1.0f, 0.0f, 0.0f, 1.0f});
  vertices.push_back({-0.5f, -0.5f, 0.0f, 1.0f, 1.0f, 0.0f, 1.0f});
  vertices.push_back({0.5f, -0.5f, 0.0f, 1.0f, 0.0f, 1.0f, 1.0f});

  vertBuff = new Renderer::VertBuffer({sizeof(vertices), ctx.gpu});
  vertBuff->setData(vertices);

  auto &gizStyle = ImViewGuizmo::GetStyle();
  gizStyle.scale = 0.5f;
  gizStyle.circleRadius = 19.0f;
  gizStyle.labelSize = 1.9f;
  gizStyle.labelColor = IM_COL32(0,0,0,0xFF);
}

Editor::Viewport3D::~Viewport3D() {
  ctx.scene->removeRenderPass(passId);
  ctx.scene->removeCopyPass(passId);
}

void Editor::Viewport3D::onRenderPass(SDL_GPUCommandBuffer* cmdBuff, SDL_GPUGraphicsPipeline* pipeline)
{
  SDL_GPURenderPass* renderPass3D = SDL_BeginGPURenderPass(cmdBuff, &fb.getTargetInfo(), 1, nullptr);
  SDL_BindGPUGraphicsPipeline(renderPass3D, pipeline);

  // bind the vertex buffer
  SDL_GPUBufferBinding bufferBindings[1];
  vertBuff->addBinding(bufferBindings[0]);
  SDL_BindGPUVertexBuffers(renderPass3D, 0, bufferBindings, 1); // bind one buffer starting from slot 0

  //SDL_SetGPUScissor(renderPass, &scissor3D);
  SDL_DrawGPUPrimitives(renderPass3D, 3, 1, 0, 0);

  SDL_EndGPURenderPass(renderPass3D);
}

void Editor::Viewport3D::onCopyPass(SDL_GPUCommandBuffer* cmdBuff, SDL_GPUCopyPass *copyPass) {
  vertBuff->upload(*copyPass);
}

namespace
{
  // @TODO: camera
  constinit glm::vec3 cameraPos{};
  constinit glm::quat cameraRot{};
}

void Editor::Viewport3D::draw() {
  auto currSize = ImGui::GetContentRegionAvail();
  auto currPos = ImGui::GetWindowPos();
  if (currSize.x < 64)currSize.x = 64;
  if (currSize.y < 64)currSize.y = 64;
  currSize.y -= 24;

  fb.resize((int)currSize.x, (int)currSize.y);

  ImGui::Text("Viewport");
  ImGui::Image(ImTextureID(fb.getTexture()), {currSize.x, currSize.y});

  ImVec2 gizPos{currPos.x + currSize.x - 40, currPos.y + 104};
  if (ImViewGuizmo::Rotate(cameraPos, cameraRot, gizPos)) {

  }
}
