/**
* @copyright 2025 - Max Bebök
* @license MIT
*/
#include "scene.h"
#include <SDL3/SDL.h>

#include "imgui.h"
#include "backends/imgui_impl_sdlgpu3.h"
#include "../context.h"

#include "./texture.h"
#include "./vertBuffer.h"
#include "framebuffer.h"
#include "shader.h"

namespace
{
  SDL_GPUGraphicsPipeline* graphicsPipeline{nullptr};
  Renderer::VertBuffer *vertBuff{nullptr};
  Renderer::Shader *shader3d{nullptr};

  std::vector<Renderer::Vertex> vertices{};
}

Renderer::Scene::Scene()
{
  shader3d = new Shader{"main3d", ctx.gpu};

  // load the vertex shader code
  SDL_GPUGraphicsPipelineCreateInfo pipelineInfo{};
  shader3d->setToPipeline(pipelineInfo);
  pipelineInfo.primitive_type = SDL_GPU_PRIMITIVETYPE_TRIANGLELIST;

  // describe the vertex buffers
  SDL_GPUVertexBufferDescription vertBuffDesc[1];
  vertBuffDesc[0].slot = 0;
  vertBuffDesc[0].input_rate = SDL_GPU_VERTEXINPUTRATE_VERTEX;
  vertBuffDesc[0].instance_step_rate = 0;
  vertBuffDesc[0].pitch = sizeof(Renderer::Vertex);

  pipelineInfo.vertex_input_state.num_vertex_buffers = 1;
  pipelineInfo.vertex_input_state.vertex_buffer_descriptions = vertBuffDesc;

  // describe the vertex attribute
  SDL_GPUVertexAttribute vertexAttributes[2];

  // a_position
  vertexAttributes[0].buffer_slot = 0; // fetch data from the buffer at slot 0
  vertexAttributes[0].location = 0; // layout (location = 0) in shader
  vertexAttributes[0].format = SDL_GPU_VERTEXELEMENTFORMAT_FLOAT3; //vec3
  vertexAttributes[0].offset = 0; // start from the first byte from current buffer position

  // a_color
  vertexAttributes[1].buffer_slot = 0; // use buffer at slot 0
  vertexAttributes[1].location = 1; // layout (location = 1) in shader
  vertexAttributes[1].format = SDL_GPU_VERTEXELEMENTFORMAT_FLOAT4; //vec4
  vertexAttributes[1].offset = sizeof(float) * 3; // 4th float from current buffer position

  pipelineInfo.vertex_input_state.num_vertex_attributes = 2;
  pipelineInfo.vertex_input_state.vertex_attributes = vertexAttributes;

  // describe the color target
  SDL_GPUColorTargetDescription colorTargetDescriptions[1];
  colorTargetDescriptions[0] = {};
  colorTargetDescriptions[0].format = SDL_GetGPUSwapchainTextureFormat(ctx.gpu, ctx.window);

  pipelineInfo.target_info.num_color_targets = 1;
  pipelineInfo.target_info.color_target_descriptions = colorTargetDescriptions;

  graphicsPipeline = SDL_CreateGPUGraphicsPipeline(ctx.gpu, &pipelineInfo);

  vertices.push_back({0.0f, 0.5f, 0.0f, 1.0f, 0.0f, 0.0f, 1.0f});
  vertices.push_back({-0.5f, -0.5f, 0.0f, 1.0f, 1.0f, 0.0f, 1.0f});
  vertices.push_back({0.5f, -0.5f, 0.0f, 1.0f, 0.0f, 1.0f, 1.0f});

  vertBuff = new Renderer::VertBuffer({sizeof(vertices), ctx.gpu});
  vertBuff->setData(vertices);

}

Renderer::Scene::~Scene() {
  SDL_ReleaseGPUGraphicsPipeline(ctx.gpu, graphicsPipeline);
  //SDL_ReleaseGPUTexture(ctx.gpu, fb3D);
}

void Renderer::Scene::update()
{
}

Renderer::Framebuffer *fb;

void Renderer::Scene::draw()
{
  if (!fb) {
    fb = new Framebuffer();
  }

  ImDrawData* draw_data = ImGui::GetDrawData();
  const bool is_minimized = (draw_data->DisplaySize.x <= 0.0f || draw_data->DisplaySize.y <= 0.0f);

  SDL_GPUCommandBuffer* command_buffer = SDL_AcquireGPUCommandBuffer(ctx.gpu); // Acquire a GPU command buffer

  SDL_GPUTexture* swapchain_texture;
  SDL_WaitAndAcquireGPUSwapchainTexture(command_buffer, ctx.window, &swapchain_texture, nullptr, nullptr); // Acquire a swapchain texture

  if(swapchain_texture == nullptr || is_minimized) {
    SDL_SubmitGPUCommandBuffer(command_buffer);
    return;
  }

  SDL_GPUColorTargetInfo targetInfo2D = {};
  targetInfo2D.texture = swapchain_texture;
  targetInfo2D.clear_color = {0.12f, 0.12f, 0.12f, 1};
  targetInfo2D.load_op = SDL_GPU_LOADOP_CLEAR;
  targetInfo2D.store_op = SDL_GPU_STOREOP_STORE;
  targetInfo2D.mip_level = 0;
  targetInfo2D.layer_or_depth_plane = 0;
  targetInfo2D.cycle = false;

  {
    ImGui_ImplSDLGPU3_PrepareDrawData(draw_data, command_buffer);
    auto copyPass = SDL_BeginGPUCopyPass(command_buffer);
    vertBuff->upload(*copyPass);
    SDL_EndGPUCopyPass(copyPass);
  }

  fb->resize(640, 480);

  if (ctx.project)
  {
    SDL_GPURenderPass* renderPass3D = SDL_BeginGPURenderPass(command_buffer, &fb->getTargetInfo(), 1, nullptr);
    SDL_BindGPUGraphicsPipeline(renderPass3D, graphicsPipeline);

    // bind the vertex buffer
    SDL_GPUBufferBinding bufferBindings[1];
    vertBuff->addBinding(bufferBindings[0]);
    SDL_BindGPUVertexBuffers(renderPass3D, 0, bufferBindings, 1); // bind one buffer starting from slot 0

    SDL_Rect scissorFull{0,0, (int)draw_data->DisplaySize.x, (int)draw_data->DisplaySize.y};
    SDL_Rect scissor3D{0,0, 640, 480};
    //SDL_SetGPUScissor(renderPass, &scissor3D);
    SDL_DrawGPUPrimitives(renderPass3D, 3, 1, 0, 0);
    //SDL_SetGPUScissor(renderPass, &scissorFull);
    SDL_EndGPURenderPass(renderPass3D);
  }


  // Render ImGui
  SDL_GPURenderPass* renderPass2D = SDL_BeginGPURenderPass(command_buffer, &targetInfo2D, 1, nullptr);
  ImGui_ImplSDLGPU3_RenderDrawData(draw_data, command_buffer, renderPass2D);
  SDL_EndGPURenderPass(renderPass2D);
  // Submit the command buffer
  SDL_SubmitGPUCommandBuffer(command_buffer);
}
